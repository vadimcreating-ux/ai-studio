import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";

// ── KIE Claude endpoints ───────────────────────────────────────────────────────
//
// Format A — Anthropic-native  (models ending in "v1messages")
//   POST https://api.kie.ai/claude/v1/messages
//   body: { model, messages, system?, tools?, stream }
//   tools schema: input_schema (Anthropic format)
//
// Format B — OpenAI-compatible  (all other models)
//   POST https://api.kie.ai/{model}/v1/chat/completions
//   body: { messages, tools?, stream }
//   system goes as { role:"system", content } first message
//   image: { type:"image_url", image_url:{ url:"data:..." } }

const KIE_BASE = "https://api.kie.ai";

function isAnthropicFormat(model: string) {
  return model.endsWith("v1messages");
}

// ── Tavily web search ─────────────────────────────────────────────────────────

async function webSearch(query: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return "[Поиск недоступен: не задан TAVILY_API_KEY]";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      }),
    });
    if (!res.ok) return `[Ошибка поиска: ${res.status}]`;
    const data = await res.json() as {
      answer?: string;
      results?: Array<{ title: string; url: string; content: string }>;
    };
    const parts: string[] = [];
    if (data.answer) parts.push(`Краткий ответ: ${data.answer}`);
    if (data.results?.length) {
      parts.push("Источники:");
      for (const r of data.results)
        parts.push(`• ${r.title}\n  URL: ${r.url}\n  ${r.content}`);
    }
    return parts.join("\n\n") || "[Поиск не дал результатов]";
  } catch (e) {
    return `[Ошибка поиска: ${e}]`;
  }
}

// ── Tool definitions ──────────────────────────────────────────────────────────

// Anthropic format (input_schema)
const TOOL_ANTHROPIC = {
  name: "web_search",
  description:
    "Поиск актуальной информации в интернете. Используй для свежих данных, новостей, текущих событий.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "Поисковый запрос" } },
    required: ["query"],
  },
};

// OpenAI format (function wrapper)
const TOOL_OPENAI = {
  type: "function",
  function: {
    name: "web_search",
    description: TOOL_ANTHROPIC.description,
    parameters: TOOL_ANTHROPIC.input_schema,
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type KieAnthropicResponse = {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  code?: number;
  msg?: string;
  error?: { message?: string };
};

type KieOpenAIResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  code?: number;
  msg?: string;
  error?: { message?: string };
};

// ── KIE request helpers ───────────────────────────────────────────────────────

async function kiePost<T>(
  url: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: T; status: number }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as T & { code?: number };
  console.log("[KIE] POST", url);
  console.log("[KIE] →", JSON.stringify(body, null, 2));
  console.log("[KIE] ←", res.status, JSON.stringify(data));
  return { ok: res.ok && data.code !== 500, data, status: res.status };
}

// ── Format A: Anthropic /v1/messages with tool_use loop ───────────────────────

async function sendAnthropic(
  apiKey: string,
  model: string,
  messages: Array<{ role: "user" | "assistant"; content: unknown }>,
  systemText: string | undefined,
  hasSearch: boolean
): Promise<{ ok: boolean; text?: string; error?: string; debug?: unknown }> {
  const url = `${KIE_BASE}/claude/v1/messages`;
  const MAX_LOOPS = 5;

  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      ...(systemText ? { system: systemText } : {}),
      ...(hasSearch ? { tools: [TOOL_ANTHROPIC] } : {}),
    };

    const { ok, data, status } = await kiePost<KieAnthropicResponse>(url, apiKey, body);

    if (!ok) {
      return {
        ok: false,
        error: data.msg || data.error?.message || "KIE вернул ошибку",
        debug: { status, body: data },
      };
    }

    const toolUseBlocks = (data.content ?? []).filter(
      (b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> => b.type === "tool_use"
    );

    if (data.stop_reason !== "tool_use" || toolUseBlocks.length === 0 || !hasSearch) {
      const textBlock = (data.content ?? []).find(
        (b): b is Extract<AnthropicContentBlock, { type: "text" }> => b.type === "text"
      );
      if (!textBlock?.text) {
        return {
          ok: false,
          error: "KIE не вернул текстовый ответ",
          debug: { status, body: data },
        };
      }
      return { ok: true, text: textBlock.text };
    }

    messages.push({ role: "assistant", content: data.content });

    const toolResults: Array<Record<string, unknown>> = [];
    for (const block of toolUseBlocks) {
      if (block.name === "web_search") {
        const query = (block.input?.query as string) || "";
        console.log(`[web_search] "${query}"`);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: await webSearch(query),
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { ok: false, error: "Превышено число итераций инструментов" };
}

// ── Format B: OpenAI-compatible /v1/chat/completions ─────────────────────────

type OaiMessage = { role: string; content: unknown; tool_call_id?: string; name?: string };

async function sendOpenAI(
  apiKey: string,
  model: string,
  messages: OaiMessage[],
  hasSearch: boolean
): Promise<{ ok: boolean; text?: string; error?: string; debug?: unknown }> {
  const url = `${KIE_BASE}/${model}/v1/chat/completions`;
  const MAX_LOOPS = 5;

  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const body: Record<string, unknown> = {
      messages,
      stream: false,
      ...(hasSearch ? { tools: [TOOL_OPENAI] } : {}),
    };

    const { ok, data, status } = await kiePost<KieOpenAIResponse>(url, apiKey, body);

    if (!ok) {
      return {
        ok: false,
        error: data.msg || data.error?.message || "KIE вернул ошибку",
        debug: { status, body: data },
      };
    }

    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) {
      return { ok: false, error: "KIE не вернул choices[0].message", debug: { status, body: data } };
    }

    const toolCalls = msg.tool_calls ?? [];

    if (choice?.finish_reason !== "tool_calls" || toolCalls.length === 0 || !hasSearch) {
      const text = msg.content ?? "";
      if (!text) {
        return { ok: false, error: "KIE не вернул текстовый ответ", debug: { status, body: data } };
      }
      return { ok: true, text };
    }

    // Добавляем ответ ассистента с tool_calls
    messages.push({ role: "assistant", content: msg.content ?? null, ...msg });

    // Выполняем инструменты
    for (const call of toolCalls) {
      if (call.function.name === "web_search") {
        let query = "";
        try { query = JSON.parse(call.function.arguments).query ?? ""; } catch {}
        console.log(`[web_search] "${query}"`);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: await webSearch(query),
        });
      }
    }
  }

  return { ok: false, error: "Превышено число итераций инструментов" };
}

// ── Chat Routes ───────────────────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {

  app.post("/api/chat/new", async (request) => {
    const body = request.body as {
      module?: string; model?: string; title?: string; project_id?: string;
    };
    const result = await dbQuery(
      `INSERT INTO chats (module, model, title, project_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        body?.module?.trim() || "claude",
        body?.model?.trim() || "claude-sonnet-4-5-v1messages",
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

  // ── Отправить сообщение ───────────────────────────────────────────────────
  app.post("/api/chat/:chatId/send", async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const body = request.body as {
      message?: string;
      files?: Array<{ dataUrl: string; mimeType: string; name: string }>;
    };
    const userText = body?.message?.trim() || "";
    const files = body?.files ?? [];
    const apiKey = process.env.KIE_API_KEY;

    if (!apiKey)
      return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    if (!userText && files.length === 0)
      return reply.status(400).send({ ok: false, error: "Пустое сообщение" });

    const chatResult = await dbQuery(`SELECT * FROM chats WHERE id = $1`, [chatId]);
    if (chatResult.rows.length === 0)
      return reply.status(404).send({ ok: false, error: "Чат не найден" });
    const chat = chatResult.rows[0];

    // Сохранить сообщение пользователя
    const savedContent = files.length > 0
      ? `${userText}${userText ? "\n" : ""}[Файлы: ${files.map(f => f.name).join(", ")}]`
      : userText;
    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)`,
      [chatId, "user", savedContent]
    );

    const countResult = await dbQuery(
      `SELECT COUNT(*) FROM chat_messages WHERE chat_id = $1`, [chatId]
    );
    if (Number(countResult.rows[0].count) === 1) {
      await dbQuery(
        `UPDATE chats SET title = $1 WHERE id = $2`,
        [(userText || files[0]?.name || "Новый чат").slice(0, 50), chatId]
      );
    }

    const historyResult = await dbQuery(
      `SELECT role, content FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
      [chatId]
    );
    const historyRows: Array<{ role: string; content: string }> = historyResult.rows;

    // ── System prompt ─────────────────────────────────────────────────────

    const gsResult = await dbQuery(
      `SELECT about, instructions, memory FROM engine_settings WHERE engine = $1`,
      [chat.module]
    );
    const globalParts: string[] = [];
    if (gsResult.rows.length > 0) {
      const g = gsResult.rows[0];
      if (g.about) globalParts.push(`О пользователе:\n${g.about}`);
      if (g.instructions) globalParts.push(`Инструкции:\n${g.instructions}`);
      if (g.memory) globalParts.push(`Глобальная память:\n${g.memory}`);
    }

    let systemText: string | undefined;
    let contextImages: Array<{ name: string; mimeType: string; dataUrl: string }> = [];

    if (chat.project_id) {
      const projectResult = await dbQuery(
        `SELECT system_prompt, style, memory, context_files FROM projects WHERE id = $1`,
        [chat.project_id]
      );
      if (projectResult.rows.length > 0) {
        const proj = projectResult.rows[0];
        const parts: string[] = [...globalParts];
        if (proj.system_prompt) parts.push(proj.system_prompt);
        if (proj.style) parts.push(`Стиль общения: ${proj.style}`);
        if (proj.memory) parts.push(`Контекст проекта:\n${proj.memory}`);

        const projFiles: Array<{ name: string; mimeType: string; dataUrl: string }> =
          Array.isArray(proj.context_files) ? proj.context_files : [];
        for (const f of projFiles) {
          if (!f.mimeType.startsWith("image/")) {
            const decoded = Buffer.from(f.dataUrl.split(",")[1] ?? "", "base64").toString("utf-8");
            parts.push(`[Файл контекста: ${f.name}]\n${decoded}`);
          }
        }
        if (parts.length > 0) systemText = parts.join("\n\n");
        contextImages = projFiles.filter(f => f.mimeType.startsWith("image/"));
      }
    } else if (globalParts.length > 0) {
      systemText = globalParts.join("\n\n");
    }

    const hasSearch = !!process.env.TAVILY_API_KEY;
    const anthropic = isAnthropicFormat(chat.model);

    try {
      let result: { ok: boolean; text?: string; error?: string; debug?: unknown };

      if (anthropic) {
        // ── Format A: Anthropic /v1/messages ─────────────────────────────

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: Array<{ role: "user" | "assistant"; content: any }> = [];

        // Контекстные изображения (Anthropic base64 source)
        if (contextImages.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const imgContent: Array<Record<string, any>> = [
            { type: "text", text: "Вот файлы контекста проекта:" },
          ];
          for (const img of contextImages) {
            imgContent.push({
              type: "image",
              source: {
                type: "base64",
                media_type: img.mimeType,
                data: img.dataUrl.split(",")[1] ?? img.dataUrl,
              },
            });
          }
          messages.push({ role: "user", content: imgContent });
          messages.push({ role: "assistant", content: "Понял, учту эти материалы." });
        }

        historyRows.forEach((row, idx) => {
          const isLastUser = idx === historyRows.length - 1 && row.role === "user";
          if (isLastUser && files.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const items: Array<Record<string, any>> = [];
            if (userText) items.push({ type: "text", text: userText });
            for (const f of files) {
              if (f.mimeType.startsWith("image/")) {
                items.push({
                  type: "image",
                  source: { type: "base64", media_type: f.mimeType, data: f.dataUrl.split(",")[1] ?? f.dataUrl },
                });
              } else {
                const decoded = Buffer.from(f.dataUrl.split(",")[1] ?? "", "base64").toString("utf-8");
                items.push({ type: "text", text: `[Файл: ${f.name}]\n${decoded}` });
              }
            }
            messages.push({ role: "user", content: items });
          } else {
            messages.push({ role: row.role as "user" | "assistant", content: row.content });
          }
        });

        result = await sendAnthropic(apiKey, chat.model, messages, systemText, hasSearch);
      } else {
        // ── Format B: OpenAI /v1/chat/completions ────────────────────────

        const messages: OaiMessage[] = [];

        // system prompt
        if (systemText) messages.push({ role: "system", content: systemText });

        // Контекстные изображения (image_url format)
        if (contextImages.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const imgContent: Array<Record<string, any>> = [
            { type: "text", text: "Вот файлы контекста проекта:" },
          ];
          for (const img of contextImages) {
            imgContent.push({
              type: "image_url",
              image_url: { url: img.dataUrl },
            });
          }
          messages.push({ role: "user", content: imgContent });
          messages.push({ role: "assistant", content: "Понял, учту эти материалы." });
        }

        historyRows.forEach((row, idx) => {
          const isLastUser = idx === historyRows.length - 1 && row.role === "user";
          if (isLastUser && files.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const items: Array<Record<string, any>> = [];
            if (userText) items.push({ type: "text", text: userText });
            for (const f of files) {
              if (f.mimeType.startsWith("image/")) {
                items.push({ type: "image_url", image_url: { url: f.dataUrl } });
              } else {
                const decoded = Buffer.from(f.dataUrl.split(",")[1] ?? "", "base64").toString("utf-8");
                items.push({ type: "text", text: `[Файл: ${f.name}]\n${decoded}` });
              }
            }
            messages.push({ role: "user", content: items });
          } else {
            messages.push({ role: row.role, content: row.content });
          }
        });

        result = await sendOpenAI(apiKey, chat.model, messages, hasSearch);
      }

      if (!result.ok) {
        return reply.status(500).send({ ok: false, error: result.error, debug: result.debug });
      }

      await dbQuery(
        `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)`,
        [chatId, "assistant", result.text]
      );

      return { ok: true, reply: result.text };
    } catch (e) {
      console.error("[chat send error]", e);
      return reply.status(500).send({ ok: false, error: "Ошибка при обращении к API" });
    }
  });
}
