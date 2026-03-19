import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";

const KIE_BASE_URL = "https://api.kie.ai";
const DEFAULT_MODEL: Record<string, string> = {
  claude:  "claude-sonnet-4-5",
  chatgpt: "gpt-5-2",
  gemini:  "gemini-2.5-pro",
};

const URL_REGEX = /https?:\/\/[^\s"'<>)\]]+/g;
const MAX_URL_CONTENT_CHARS = 15000;

async function fetchUrlContent(url: string): Promise<string> {
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
  module, model, systemText, history, userText, files, webSearch, apiKey, log,
}: {
  module: string;
  model: string;
  systemText: string;
  history: Array<{ role: string; content: string }>;
  userText: string;
  files?: KieFile[];
  webSearch?: boolean;
  apiKey: string;
  log: FastifyInstance["log"];
}): Promise<{ reply: string } | { error: string; status: number }> {

  if (module === "claude") {
    // ── Anthropic Messages API ──────────────────────────────────────────────
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

    const requestBody: Record<string, unknown> = { model, messages, stream: false };
    if (systemText) requestBody.system = systemText;
    if (webSearch) {
      requestBody.tools = [{
        name: "googleSearch",
        description: "Search the internet for current information",
        input_schema: {
          type: "object",
          properties: { query: { type: "string", description: "Search query" } },
          required: ["query"],
        },
      }];
    }

    const res = await fetch(`${KIE_BASE_URL}/claude/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const err = await res.text();
      log.error(`kie.ai claude error ${res.status}: ${err}`);
      return { error: `Ошибка kie.ai: ${res.status}`, status: 502 };
    }
    const raw = await res.text();
    log.info(`kie.ai claude response: ${raw.slice(0, 1000)}`);
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (typeof data.code === "number" && data.code !== 200) {
      return { error: `Ошибка kie.ai: ${data.msg} (code ${data.code})`, status: 502 };
    }
    const blocks = data.content;
    let reply = "";
    if (Array.isArray(blocks)) {
      reply = (blocks as Array<{ type?: string; text?: string }>)
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text ?? "")
        .join("").trim();
    }
    if (!reply) {
      log.error(`kie.ai claude empty. Full: ${raw.slice(0, 2000)}`);
      return { error: "Пустой ответ от kie.ai", status: 502 };
    }
    return { reply };

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
    });

    if (!res.ok) {
      const err = await res.text();
      log.error(`kie.ai ${module} error ${res.status}: ${err}`);
      return { error: `Ошибка kie.ai: ${res.status}`, status: 502 };
    }
    const raw = await res.text();
    log.info(`kie.ai ${module} response: ${raw.slice(0, 1000)}`);
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (typeof data.code === "number" && data.code !== 200) {
      return { error: `Ошибка kie.ai: ${data.msg} (code ${data.code})`, status: 502 };
    }
    const reply = (data as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content?.trim() ?? "";
    if (!reply) {
      log.error(`kie.ai ${module} empty. Full: ${raw.slice(0, 2000)}`);
      return { error: "Пустой ответ от kie.ai", status: 502 };
    }
    return { reply };
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {

  app.post("/api/chat/new", async (request) => {
    const body = request.body as {
      module?: string; model?: string; title?: string; project_id?: string;
    };
    const module = body?.module?.trim() || "claude";
    const result = await dbQuery(
      `INSERT INTO chats (module, model, title, project_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        module,
        body?.model?.trim() || DEFAULT_MODEL[module] || DEFAULT_MODEL.claude,
        body?.title?.trim() || "Новый чат",
        body?.project_id?.trim() || null,
      ]
    );
    return { ok: true, chat: result.rows[0] };
  });

  app.get("/api/chat/list", async (request) => {
    const q = request.query as { module?: string; project_id?: string };
    const module = q?.module?.trim() || "claude";
    const project_id = q?.project_id?.trim() || null;
    const result = project_id
      ? await dbQuery(
          `SELECT * FROM chats WHERE module = $1 AND project_id = $2 ORDER BY created_at DESC`,
          [module, project_id]
        )
      : await dbQuery(
          `SELECT * FROM chats WHERE module = $1 ORDER BY created_at DESC`,
          [module]
        );
    return { ok: true, chats: result.rows };
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
    const body = request.body as { model?: string; title?: string; project_id?: string | null };

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.model !== undefined) { updates.push(`model = $${idx++}`); values.push(body.model.trim()); }
    if (body.title !== undefined) { updates.push(`title = $${idx++}`); values.push(body.title.trim()); }
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
    const body = request.body as { content?: string };
    const content = body.content?.trim();
    if (!content) return reply.status(400).send({ ok: false, error: "Пустое сообщение" });

    const result = await dbQuery(
      `UPDATE chat_messages SET content = $1 WHERE id = $2 AND chat_id = $3 RETURNING *`,
      [content, messageId, chatId]
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
  app.post("/api/chat/:chatId/messages/:messageId/regenerate", async (request, reply) => {
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

    const [chatRes, settingsRes] = await Promise.all([
      dbQuery(`SELECT * FROM chats WHERE id = $1`, [chatId]),
      // will be loaded after we know the module
      Promise.resolve(null),
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

    // Last user message text (for regeneration context)
    const lastUserMsg = history[history.length - 1];

    const result = await callKieAI({
      module: chat.module,
      model: chat.model,
      systemText: systemParts.join("\n\n"),
      history: history.slice(0, -1), // all except the last user msg
      userText: lastUserMsg.content,
      apiKey,
      log: app.log,
    });

    if ("error" in result) {
      return reply.status(result.status).send({ ok: false, error: result.error });
    }

    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'assistant', $2)`,
      [chatId, result.reply]
    );
    return { ok: true, reply: result.reply };
  });

  app.post("/api/chat/:chatId/send", async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const body = request.body as {
      message: string;
      files?: KieFile[];
      webSearch?: boolean;
    };

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    }

    const userText = body.message?.trim();
    if (!userText) {
      return reply.status(400).send({ ok: false, error: "Пустое сообщение" });
    }

    // Load chat + engine settings for the correct engine + history
    const chatRes = await dbQuery(`SELECT * FROM chats WHERE id = $1`, [chatId]);
    if (chatRes.rows.length === 0) {
      return reply.status(404).send({ ok: false, error: "Чат не найден" });
    }
    const chat = chatRes.rows[0] as { module: string; model: string };

    const [settingsRes, historyRes] = await Promise.all([
      dbQuery(`SELECT * FROM engine_settings WHERE engine = $1`, [chat.module]),
      dbQuery(`SELECT role, content FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`, [chatId]),
    ]);

    const settings = settingsRes.rows[0];
    const systemParts: string[] = [];
    if (settings?.about?.trim())        systemParts.push(settings.about.trim());
    if (settings?.instructions?.trim()) systemParts.push(settings.instructions.trim());
    if (settings?.memory?.trim())       systemParts.push(`Память:\n${settings.memory.trim()}`);

    // Fetch URLs mentioned in system prompt or user message
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

    // Save user message to DB
    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'user', $2)`,
      [chatId, userText]
    );

    const result = await callKieAI({
      module: chat.module,
      model: chat.model,
      systemText: systemParts.join("\n\n"),
      history: historyRes.rows as Array<{ role: string; content: string }>,
      userText,
      files: body.files,
      webSearch: body.webSearch,
      apiKey,
      log: app.log,
    });

    if ("error" in result) {
      return reply.status(result.status).send({ ok: false, error: result.error });
    }

    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'assistant', $2)`,
      [chatId, result.reply]
    );

    return { ok: true, reply: result.reply };
  });
}
