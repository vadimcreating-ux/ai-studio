import type { FastifyInstance, FastifyReply } from "fastify";
import { dbQuery } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";
import { atomicDeduct, getBalance } from "../lib/credits.js";
import {
  CreateChatSchema,
  UpdateChatSchema,
  SendMessageSchema,
  EditMessageSchema,
  ChatListQuerySchema,
} from "../lib/validation.js";

// Quick non-atomic balance check for early rejection (UX only).
// Actual protection is in spendCredits → atomicDeduct.
async function checkCredits(userId: string, reply: FastifyReply): Promise<boolean> {
  const balance = await getBalance(userId);
  if (balance <= 0) {
    reply.status(402).send({ ok: false, error: "Недостаточно кредитов. Пополните баланс в настройках аккаунта." });
    return false;
  }
  return true;
}

// Atomically deduct KIE credits × markup. Returns 0 if balance insufficient.
// Since chat amount is known only after KIE response, we allow small overdraft
// (balance >= 0 was verified at start; tiny race window is acceptable for chat).
async function spendCredits(userId: string, kieAmount: number, operation: string): Promise<number> {
  if (kieAmount <= 0) return 0;
  let markupPercent = 0;
  try {
    const priceRes = await dbQuery(
      "SELECT markup_percent FROM credit_prices WHERE operation = $1",
      [operation]
    );
    markupPercent = Number(priceRes.rows[0]?.markup_percent ?? 0);
  } catch { /* column might not exist yet */ }
  const amount = Math.round(kieAmount * (1 + markupPercent / 100) * 10000) / 10000;
  // Try atomic deduction (no overdraft)
  const deducted = await atomicDeduct(userId, amount, operation, `Запрос к ${operation}`);
  if (deducted > 0) return deducted;
  // Balance went to zero between check and deduction (race window).
  // Force-deduct to avoid denying an already-processed KIE response.
  // This creates at most one message worth of debt (< 1 credit typically).
  await dbQuery(
    "UPDATE users SET credits_balance = credits_balance - $1 WHERE id = $2",
    [amount, userId]
  );
  await dbQuery(
    "INSERT INTO credit_transactions (user_id, amount, type, operation, description) VALUES ($1, $2, 'spend', $3, $4)",
    [userId, -amount, operation, `Запрос к ${operation} (принудительно)`]
  );
  return amount;
}

const KIE_BASE_URL = "https://api.kie.ai";
const DEFAULT_MODEL: Record<string, string> = {
  claude:  "claude-sonnet-4-5",
  chatgpt: "gpt-5-2",
  gemini:  "gemini-2.5-pro",
};

const URL_REGEX = /https?:\/\/[^\s"'<>)\]]+/g;
const MAX_URL_CONTENT_CHARS = 15000;

// SSRF-защита: разрешаем только публичные HTTP(S) URLs, блокируем приватные подсети и localhost
const PRIVATE_IP_REGEX = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.0\.0\.0)/i;

function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname;
    if (PRIVATE_IP_REGEX.test(host)) return false;
    // Запрещаем IP-адреса (только доменные имена)
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchUrlContent(url: string): Promise<string> {
  if (!isSafeUrl(url)) {
    return `[URL пропущен по соображениям безопасности: ${url}]`;
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Studio-Bot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const cleaned = text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.slice(0, MAX_URL_CONTENT_CHARS);
  } catch (e) {
    return `[Не удалось загрузить ${url}: ${e instanceof Error ? e.message : e}]`;
  }
}

function extractUrls(text: string): string[] {
  return [...new Set(text.match(URL_REGEX) ?? [])];
}

// ─── KIE routing ────────────────────────────────────────────────────────────
//
// Claude  → Anthropic Messages API  POST /claude/v1/messages
//           Response: { content: [{ type: "text", text }] }
//
// ChatGPT/Gemini → OpenAI Chat Completions  POST /{model}/v1/chat/completions
//           Response: { choices: [{ message: { content } }] }
//
// ВАЖНО: не менять этот роутинг без явного подтверждения!
// ────────────────────────────────────────────────────────────────────────────

type KieFile = { dataUrl: string; mimeType: string; name: string };

async function callKieAI({
  module, model, systemText, history, userText, files, webSearch, thinking, apiKey, log,
}: {
  module: string;
  model: string;
  systemText: string;
  history: Array<{ role: string; content: string }>;
  userText: string;
  files?: KieFile[];
  webSearch?: boolean;
  thinking?: boolean;
  apiKey: string;
  log: FastifyInstance["log"];
}): Promise<{ reply: string; thinkingContent?: string; creditsConsumed: number } | { error: string; status: number }> {
  // Retry up to 2 extra times on transient KIE 500
  const KIE_RETRY_DELAYS = [3000, 6000];
  let lastResult: { reply: string; thinkingContent?: string; creditsConsumed: number } | { error: string; status: number } | null = null;
  for (let attempt = 0; attempt <= KIE_RETRY_DELAYS.length; attempt++) {
    lastResult = await callKieAIOnce({ module, model, systemText, history, userText, files, webSearch, thinking, apiKey, log });
    if (!("error" in lastResult)) return lastResult; // success
    if (attempt < KIE_RETRY_DELAYS.length) {
      log.warn(`kie.ai transient error (retry ${attempt + 1}/${KIE_RETRY_DELAYS.length}): ${lastResult.error}`);
      await new Promise((r) => setTimeout(r, KIE_RETRY_DELAYS[attempt]));
    }
  }
  return lastResult!;
}

async function callKieAIOnce({
  module, model, systemText, history, userText, files, webSearch, thinking, apiKey, log,
}: {
  module: string;
  model: string;
  systemText: string;
  history: Array<{ role: string; content: string }>;
  userText: string;
  files?: KieFile[];
  webSearch?: boolean;
  thinking?: boolean;
  apiKey: string;
  log: FastifyInstance["log"];
}): Promise<{ reply: string; thinkingContent?: string; creditsConsumed: number } | { error: string; status: number }> {

  if (module === "claude") {
    // ── KIE Claude API — POST /claude/v1/messages (Anthropic Messages format)
    // Docs: https://docs.kie.ai/market/claude/claude-sonnet-4-5
    // Required: model, messages
    // Optional: tools, thinkingFlag, stream (default: true), output_config
    // NOTE: max_tokens is NOT a KIE parameter — omit it
    type Msg = { role: string; content: string | unknown[] };
    const messages: Msg[] = history.map((r) => ({ role: r.role, content: r.content }));

    // Build current user content block (text + optional files)
    if (files && files.length > 0) {
      const parts: unknown[] = [{ type: "text", text: userText }];
      for (const f of files) {
        if (f.mimeType.startsWith("image/")) {
          const base64 = f.dataUrl.split(",")[1] ?? f.dataUrl;
          parts.push({ type: "image", source: { type: "base64", media_type: f.mimeType, data: base64 } });
        } else {
          const base64 = f.dataUrl.split(",")[1] ?? "";
          const decoded = Buffer.from(base64, "base64").toString("utf-8");
          parts.push({ type: "text", text: `\n\n[${f.name}]\n${decoded}` });
        }
      }
      messages.push({ role: "user", content: parts });
    } else {
      messages.push({ role: "user", content: userText });
    }

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };
    if (systemText) requestBody.system = systemText;
    if (thinking) requestBody.thinkingFlag = true;

    log.info(`kie.ai claude request: model=${model} msgs=${messages.length} sysLen=${systemText?.length ?? 0}`);
    const res = await fetch(`${KIE_BASE_URL}/claude/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const err = await res.text();
      log.error(`kie.ai claude error ${res.status}: ${err}`);
      return { error: `Ошибка kie.ai: ${res.status}`, status: 502 };
    }
    const raw = await res.text();
    log.info(`kie.ai claude full response: ${raw}`);
    if (!raw.trim()) {
      log.error("kie.ai claude empty response body");
      return { error: "Пустой ответ от kie.ai", status: 502 };
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      log.error(`kie.ai claude JSON parse error: ${e}. Raw: ${raw.slice(0, 500)}`);
      return { error: "Неверный формат ответа от kie.ai", status: 502 };
    }

    // KIE may return HTTP 200 with an error inside
    if (typeof data.code === "number" && data.code !== 200) {
      return { error: `Ошибка kie.ai: ${data.msg} (code ${data.code})`, status: 502 };
    }

    // Extract text and thinking blocks from content
    const blocks = data.content;
    let reply = "";
    let thinkingContent = "";
    if (Array.isArray(blocks)) {
      const typed = blocks as Array<{ type?: string; text?: string; thinking?: string }>;
      thinkingContent = typed
        .filter((b) => b.type === "thinking" && b.thinking)
        .map((b) => b.thinking ?? "")
        .join("").trim();
      reply = typed
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text ?? "")
        .join("").trim();
    }
    if (!reply) {
      log.error(`kie.ai claude no text content. stop_reason=${data.stop_reason}. Full: ${raw.slice(0, 2000)}`);
      return { error: "Пустой ответ от kie.ai", status: 502 };
    }
    const creditsConsumed = Number(data.credits_consumed ?? 0) || 0;
    return { reply, thinkingContent: thinkingContent || undefined, creditsConsumed };

  } else {
    // ── OpenAI Chat Completions API (chatgpt / gemini) ──────────────────────
    type Msg = { role: string; content: string | unknown[] };
    const messages: Msg[] = [];

    if (systemText) {
      messages.push({ role: "system", content: [{ type: "text", text: systemText }] });
    }
    for (const r of history) {
      messages.push({ role: r.role, content: r.content });
    }

    // Build current user content (text + optional files in OpenAI format)
    if (files && files.length > 0) {
      const parts: unknown[] = [{ type: "text", text: userText }];
      for (const f of files) {
        if (f.mimeType.startsWith("image/")) {
          parts.push({ type: "image_url", image_url: { url: f.dataUrl } });
        } else {
          const base64 = f.dataUrl.split(",")[1] ?? "";
          const decoded = Buffer.from(base64, "base64").toString("utf-8");
          parts.push({ type: "text", text: `\n\n[${f.name}]\n${decoded}` });
        }
      }
      messages.push({ role: "user", content: parts });
    } else {
      messages.push({ role: "user", content: [{ type: "text", text: userText }] });
    }

    const res = await fetch(`${KIE_BASE_URL}/${model}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ messages, stream: false }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const err = await res.text();
      log.error(`kie.ai ${module} error ${res.status}: ${err}`);
      return { error: `Ошибка kie.ai: ${res.status}`, status: 502 };
    }
    const raw = await res.text();
    log.info(`kie.ai ${module} full response: ${raw}`);
    if (!raw.trim()) {
      log.error(`kie.ai ${module} empty response body`);
      return { error: "Пустой ответ от kie.ai", status: 502 };
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      log.error(`kie.ai ${module} JSON parse error: ${e}. Raw: ${raw.slice(0, 500)}`);
      return { error: "Неверный формат ответа от kie.ai", status: 502 };
    }

    if (typeof data.code === "number" && data.code !== 200) {
      return { error: `Ошибка kie.ai: ${data.msg} (code ${data.code})`, status: 502 };
    }
    const reply = (data as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content?.trim() ?? "";
    if (!reply) {
      log.error(`kie.ai ${module} empty. Full: ${raw.slice(0, 2000)}`);
      return { error: "Пустой ответ от kie.ai", status: 502 };
    }
    const creditsConsumed = Number(data.credits_consumed ?? 0) || 0;
    return { reply, creditsConsumed };
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post("/api/chat/new", async (request, reply) => {
    const user = request.authUser!;
    const parsed = CreateChatSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
    const body = parsed.data;
    const module = body.module ?? "claude";
    const result = await dbQuery(
      `INSERT INTO chats (module, model, title, project_id, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        module,
        body.model ?? DEFAULT_MODEL[module] ?? DEFAULT_MODEL.claude,
        body.title ?? "Новый чат",
        body.project_id ?? null,
        user.userId,
      ]
    );
    return { ok: true, chat: result.rows[0] };
  });

  app.get("/api/chat/list", async (request, reply) => {
    const user = request.authUser!;
    const parsed = ChatListQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные параметры" });
    const { module, project_id, limit, offset } = parsed.data;
    const mod = module ?? "claude";

    // Admin sees all chats; regular users see only their own (+ legacy null user_id chats)
    const userFilter = user.role === "admin" ? "" : `AND (user_id = '${user.userId}' OR user_id IS NULL)`;

    const result = project_id
      ? await dbQuery(
          `SELECT * FROM chats WHERE module = $1 AND project_id = $2 ${userFilter} ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
          [mod, project_id, limit, offset]
        )
      : await dbQuery(
          `SELECT * FROM chats WHERE module = $1 ${userFilter} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [mod, limit, offset]
        );

    const totalResult = project_id
      ? await dbQuery(`SELECT COUNT(*) FROM chats WHERE module = $1 AND project_id = $2 ${userFilter}`, [mod, project_id])
      : await dbQuery(`SELECT COUNT(*) FROM chats WHERE module = $1 ${userFilter}`, [mod]);

    return {
      ok: true,
      chats: result.rows,
      total: parseInt(totalResult.rows[0].count, 10),
      limit,
      offset,
    };
  });

  app.get("/api/chat/:chatId/messages", async (request) => {
    const { chatId } = request.params as { chatId: string };
    const result = await dbQuery(
      `SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
      [chatId]
    );
    return { ok: true, messages: result.rows };
  });

  app.patch("/api/chat/:chatId", async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const parsed = UpdateChatSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
    const body = parsed.data;

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.model !== undefined) { updates.push(`model = $${idx++}`); values.push(body.model); }
    if (body.title !== undefined) { updates.push(`title = $${idx++}`); values.push(body.title); }
    if ("project_id" in body) { updates.push(`project_id = $${idx++}`); values.push(body.project_id ?? null); }

    if (updates.length === 0)
      return reply.status(400).send({ ok: false, error: "Нечего обновлять" });

    values.push(chatId);
    const result = await dbQuery(
      `UPDATE chats SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return { ok: true, chat: result.rows[0] };
  });

  app.delete("/api/chat/:chatId", async (request) => {
    const { chatId } = request.params as { chatId: string };
    await dbQuery(`DELETE FROM chats WHERE id = $1`, [chatId]);
    return { ok: true };
  });

  // Edit a single message
  app.patch("/api/chat/:chatId/messages/:messageId", async (request, reply) => {
    const { chatId, messageId } = request.params as { chatId: string; messageId: string };
    const parsed = EditMessageSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });

    const result = await dbQuery(
      `UPDATE chat_messages SET content = $1 WHERE id = $2 AND chat_id = $3 RETURNING *`,
      [parsed.data.content, messageId, chatId]
    );
    if (result.rows.length === 0)
      return reply.status(404).send({ ok: false, error: "Сообщение не найдено" });
    return { ok: true, message: result.rows[0] };
  });

  // Delete a single message
  app.delete("/api/chat/:chatId/messages/:messageId", async (request, reply) => {
    const { chatId, messageId } = request.params as { chatId: string; messageId: string };
    const result = await dbQuery(
      `DELETE FROM chat_messages WHERE id = $1 AND chat_id = $2 RETURNING id`,
      [messageId, chatId]
    );
    if (result.rows.length === 0)
      return reply.status(404).send({ ok: false, error: "Сообщение не найдено" });
    return { ok: true };
  });

  // Regenerate: delete target message + all after it, then re-call KIE
  app.post("/api/chat/:chatId/messages/:messageId/regenerate", {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
        keyGenerator: (req: any) => req.authUser?.userId || req.ip,
      },
    },
  }, async (request, reply) => {
    const user = request.authUser!;
    const { chatId, messageId } = request.params as { chatId: string; messageId: string };

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });

    const msgRes = await dbQuery(
      `SELECT * FROM chat_messages WHERE id = $1 AND chat_id = $2`,
      [messageId, chatId]
    );
    if (msgRes.rows.length === 0)
      return reply.status(404).send({ ok: false, error: "Сообщение не найдено" });

    const targetMsg = msgRes.rows[0] as { created_at: string };

    const historyRes = await dbQuery(
      `SELECT role, content FROM chat_messages WHERE chat_id = $1 AND created_at < $2 ORDER BY created_at ASC`,
      [chatId, targetMsg.created_at]
    );

    await dbQuery(
      `DELETE FROM chat_messages WHERE chat_id = $1 AND created_at >= $2`,
      [chatId, targetMsg.created_at]
    );

    const history = historyRes.rows as Array<{ role: string; content: string }>;
    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return reply.status(400).send({ ok: false, error: "История должна заканчиваться сообщением пользователя" });
    }

    const [chatRes] = await Promise.all([
      dbQuery(`SELECT * FROM chats WHERE id = $1`, [chatId]),
    ]);
    if (chatRes.rows.length === 0)
      return reply.status(404).send({ ok: false, error: "Чат не найден" });

    const chat = chatRes.rows[0] as { module: string; model: string };
    const settingsRow = await dbQuery(
      `SELECT * FROM engine_settings WHERE engine = $1`,
      [chat.module]
    );

    const settings = settingsRow.rows[0];
    const systemParts: string[] = [];
    if (settings?.about?.trim())        systemParts.push(settings.about.trim());
    if (settings?.instructions?.trim()) systemParts.push(settings.instructions.trim());
    if (settings?.memory?.trim())       systemParts.push(`Память:\n${settings.memory.trim()}`);

    const lastUserMsg = history[history.length - 1];

    const regenOperation = `chat_${chat.module}`;
    const creditsOk = await checkCredits(user.userId, reply);
    if (!creditsOk) return;

    const result = await callKieAI({
      module: chat.module,
      model: chat.model,
      systemText: systemParts.join("\n\n"),
      history: history.slice(0, -1),
      userText: lastUserMsg.content,
      apiKey,
      log: app.log,
    });

    const regenReply = "error" in result
      ? "Не удалось соединиться с сервером ИИ. Пожалуйста, повторите запрос."
      : result.reply;
    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'assistant', $2)`,
      [chatId, regenReply]
    );
    if ("error" in result) {
      app.log.error(`kie.ai regenerate failed after retries: ${result.error}`);
      return { ok: true, reply: regenReply, credits_spent: 0 };
    }
    let creditsSpent = 0;
    try {
      creditsSpent = await spendCredits(user.userId, result.creditsConsumed, regenOperation);
    } catch (err) {
      app.log.error({ err }, "spendCredits failed on regenerate");
    }
    return { ok: true, reply: result.reply, credits_spent: creditsSpent };
  });

  // 30 запросов в минуту на отправку — защита от случайных петель, не от пользователя
  app.post("/api/chat/:chatId/send", {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
        keyGenerator: (req: any) => req.authUser?.userId || req.ip,
      },
    },
  }, async (request, reply) => {
    const user = request.authUser!;
    const { chatId } = request.params as { chatId: string };
    const parsed = SendMessageSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    }

    const { message: userText, files, webSearch, thinking } = parsed.data;

    const chatRes = await dbQuery(`SELECT * FROM chats WHERE id = $1`, [chatId]);
    if (chatRes.rows.length === 0) {
      return reply.status(404).send({ ok: false, error: "Чат не найден" });
    }
    const chat = chatRes.rows[0] as { module: string; model: string };

    const operation = `chat_${chat.module}`;
    const ok = await checkCredits(user.userId, reply);
    if (!ok) return;

    const [settingsRes, historyRes] = await Promise.all([
      dbQuery(`SELECT * FROM engine_settings WHERE engine = $1`, [chat.module]),
      dbQuery(`SELECT role, content FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`, [chatId]),
    ]);

    const settings = settingsRes.rows[0];
    const systemParts: string[] = [];
    if (settings?.about?.trim())        systemParts.push(settings.about.trim());
    if (settings?.instructions?.trim()) systemParts.push(settings.instructions.trim());
    if (settings?.memory?.trim())       systemParts.push(`Память:\n${settings.memory.trim()}`);

    // Fetch URLs mentioned in system prompt or user message (с SSRF-защитой)
    const allText = [...systemParts, userText].join("\n");
    const urls = extractUrls(allText);
    if (urls.length > 0) {
      const fetched = await Promise.all(
        urls.map(async (url) => {
          const content = await fetchUrlContent(url);
          return `=== Содержимое ${url} ===\n${content}`;
        })
      );
      systemParts.push(`Содержимое URL из промпта:\n\n${fetched.join("\n\n")}`);
    }

    // Store file metadata (images as dataUrl, others as name+mimeType only)
    const attachedFiles = files && files.length > 0
      ? files.map((f: { dataUrl: string; mimeType: string; name: string }) => ({
          name: f.name,
          mimeType: f.mimeType,
          dataUrl: f.mimeType.startsWith("image/") ? f.dataUrl : null,
        }))
      : null;

    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content, attached_files) VALUES ($1, 'user', $2, $3)`,
      [chatId, userText, attachedFiles ? JSON.stringify(attachedFiles) : null]
    );

    const result = await callKieAI({
      module: chat.module,
      model: chat.model,
      systemText: systemParts.join("\n\n"),
      history: historyRes.rows as Array<{ role: string; content: string }>,
      userText,
      files,
      webSearch,
      thinking: thinking && chat.module === "claude" ? true : undefined,
      apiKey,
      log: app.log,
    });

    const sendReply = "error" in result
      ? "Не удалось соединиться с сервером ИИ. Пожалуйста, повторите запрос."
      : result.reply;
    const thinkingContent = "error" in result ? null : (result.thinkingContent ?? null);
    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content, thinking_content) VALUES ($1, 'assistant', $2, $3)`,
      [chatId, sendReply, thinkingContent]
    );
    if ("error" in result) {
      app.log.error(`kie.ai send failed after retries: ${result.error}`);
      return { ok: true, reply: sendReply, credits_spent: 0 };
    }
    let creditsSpent = 0;
    try {
      creditsSpent = await spendCredits(user.userId, result.creditsConsumed, operation);
    } catch (err) {
      app.log.error({ err }, "spendCredits failed on send");
    }

    return { ok: true, reply: sendReply, credits_spent: creditsSpent };
  });
}
