import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";

// ── KIE API ───────────────────────────────────────────────────────────────────
// Docs: https://docs.kie.ai/30749672e0
// Endpoint: POST https://api.kie.ai/claude/v1/messages
// Model:    claude-sonnet-4-5-v1messages

const KIE_URL = "https://api.kie.ai/claude/v1/messages";

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

    if (!res.ok) return `[Ошибка поиска: ${res.status} ${await res.text()}]`;

    const data = await res.json() as {
      answer?: string;
      results?: Array<{ title: string; url: string; content: string }>;
    };

    const parts: string[] = [];
    if (data.answer) parts.push(`Краткий ответ: ${data.answer}`);
    if (data.results?.length) {
      parts.push("Источники:");
      for (const r of data.results) {
        parts.push(`• ${r.title}\n  URL: ${r.url}\n  ${r.content}`);
      }
    }
    return parts.join("\n\n") || "[Поиск не дал результатов]";
  } catch (e) {
    return `[Ошибка поиска: ${e}]`;
  }
}

// ── Tool definition (Anthropic/KIE format) ───────────────────────────────────

const WEB_SEARCH_TOOL = {
  name: "web_search",
  description:
    "Поиск актуальной информации в интернете. Используй, когда нужны свежие данные, новости, текущие события или информация, которая могла измениться после твоего обучения.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Поисковый запрос" },
    },
    required: ["query"],
  },
};

// ── KIE request/response types ────────────────────────────────────────────────

type KieContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown>; caller?: unknown };

type KieResponse = {
  type?: string;
  id?: string;
  role?: string;
  model?: string;
  content?: KieContentBlock[];
  stop_reason?: string;
  usage?: unknown;
  credits_consumed?: number;
  // KIE error wrapper (HTTP 200 but error inside)
  code?: number;
  msg?: string;
  error?: { message?: string };
};

// ── Send one request to KIE Claude ───────────────────────────────────────────

async function kieRequest(
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: KieResponse; status: number }> {
  const res = await fetch(KIE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as KieResponse;
  console.log("[KIE] →", JSON.stringify(body, null, 2));
  console.log("[KIE] ←", res.status, JSON.stringify(data));
  return { ok: res.ok && data.code !== 500, data, status: res.status };
}

// ── Chat Routes ───────────────────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {

  // Создать новый чат
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

  // Список чатов
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

  // История сообщений
  app.get("/api/chat/:chatId/messages", async (request) => {
    const { chatId } = request.params as { chatId: string };
    const result = await dbQuery(
      `SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
      [chatId]
    );
    return { ok: true, messages: result.rows };
  });

  // Обновить чат
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

  // Удалить чат
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

    // Получить чат
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

    // Обновить заголовок при первом сообщении
    const countResult = await dbQuery(
      `SELECT COUNT(*) FROM chat_messages WHERE chat_id = $1`, [chatId]
    );
    if (Number(countResult.rows[0].count) === 1) {
      await dbQuery(
        `UPDATE chats SET title = $1 WHERE id = $2`,
        [(userText || files[0]?.name || "Новый чат").slice(0, 50), chatId]
      );
    }

    // Загрузить историю
    const historyResult = await dbQuery(
      `SELECT role, content FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
      [chatId]
    );
    const historyRows: Array<{ role: string; content: string }> = historyResult.rows;

    // ── Собрать system prompt ─────────────────────────────────────────────

    const globalSettingsResult = await dbQuery(
      `SELECT about, instructions, memory FROM engine_settings WHERE engine = $1`,
      [chat.module]
    );
    const globalParts: string[] = [];
    if (globalSettingsResult.rows.length > 0) {
      const g = globalSettingsResult.rows[0];
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

    // ── Собрать messages в Anthropic-формате ─────────────────────────────
    // Согласно KIE docs: role "user"/"assistant", content — строка или массив блоков

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: Array<{ role: "user" | "assistant"; content: any }> = [];

    // Контекстные изображения как первая user/assistant пара
    if (contextImages.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgContent: Array<Record<string, any>> = [
        { type: "text", text: "Вот файлы контекста проекта, учитывай их во всех ответах:" },
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
      messages.push({ role: "assistant", content: "Понял, учту эти материалы как контекст проекта." });
    }

    // История
    historyRows.forEach((row, idx) => {
      const isLastUser = idx === historyRows.length - 1 && row.role === "user";

      if (isLastUser && files.length > 0) {
        // Последнее сообщение пользователя с файлами — массив блоков
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: Array<Record<string, any>> = [];
        if (userText) items.push({ type: "text", text: userText });
        for (const f of files) {
          if (f.mimeType.startsWith("image/")) {
            items.push({
              type: "image",
              source: {
                type: "base64",
                media_type: f.mimeType,
                data: f.dataUrl.split(",")[1] ?? f.dataUrl,
              },
            });
          } else {
            const decoded = Buffer.from(f.dataUrl.split(",")[1] ?? "", "base64").toString("utf-8");
            items.push({ type: "text", text: `[Файл: ${f.name}]\n${decoded}` });
          }
        }
        messages.push({ role: "user", content: items });
      } else {
        // Строка — как показано в KIE docs
        messages.push({ role: row.role as "user" | "assistant", content: row.content });
      }
    });

    const hasSearch = !!process.env.TAVILY_API_KEY;

    try {
      let assistantText: string | undefined;

      // ── Tool_use цикл (Anthropic spec + KIE docs) ─────────────────────────
      // 1. Отправляем запрос с tools
      // 2. Если stop_reason = "tool_use" → выполняем инструменты → повторяем
      // 3. Если stop_reason = "end_turn" (или нет tool_use) → финальный ответ

      const MAX_LOOPS = 5;
      for (let loop = 0; loop < MAX_LOOPS; loop++) {
        const reqBody: Record<string, unknown> = {
          model: chat.model,
          messages,
          stream: false,
          ...(systemText ? { system: systemText } : {}),
          ...(hasSearch ? { tools: [WEB_SEARCH_TOOL] } : {}),
        };

        const { ok, data, status } = await kieRequest(apiKey, reqBody);

        if (!ok) {
          return reply.status(500).send({
            ok: false,
            error: data.msg || data.error?.message || "KIE вернул ошибку",
            debug: { status, body: data },
          });
        }

        const toolUseBlocks = (data.content ?? []).filter(
          (b): b is Extract<KieContentBlock, { type: "tool_use" }> => b.type === "tool_use"
        );

        // Финальный ответ
        if (data.stop_reason !== "tool_use" || toolUseBlocks.length === 0 || !hasSearch) {
          const textBlock = (data.content ?? []).find(
            (b): b is Extract<KieContentBlock, { type: "text" }> => b.type === "text"
          );
          if (!textBlock?.text) {
            return reply.status(500).send({
              ok: false,
              error: "KIE не вернул текстовый ответ",
              debug: { status, body: data },
            });
          }
          assistantText = textBlock.text;
          break;
        }

        // Добавляем ответ ассистента с tool_use блоками
        messages.push({ role: "assistant", content: data.content });

        // Выполняем инструменты и собираем tool_result
        const toolResults: Array<Record<string, unknown>> = [];
        for (const block of toolUseBlocks) {
          if (block.name === "web_search") {
            const query = (block.input?.query as string) || "";
            console.log(`[web_search] query: "${query}"`);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: await webSearch(query),
            });
          }
        }

        // Возвращаем tool_result пользователем (Anthropic spec)
        messages.push({ role: "user", content: toolResults });
      }

      assistantText ??= "[Не удалось получить ответ]";

      // Сохранить ответ ассистента
      await dbQuery(
        `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)`,
        [chatId, "assistant", assistantText]
      );

      return { ok: true, reply: assistantText };
    } catch (e) {
      console.error("[chat send error]", e);
      return reply.status(500).send({ ok: false, error: "Ошибка при обращении к API" });
    }
  });
}
