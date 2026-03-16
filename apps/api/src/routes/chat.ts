import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";

const KIE_BASE_URL = "https://api.kie.ai";

// ── Tavily Web Search ─────────────────────────────────────────────────────────

async function webSearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "[Поиск недоступен: не задан TAVILY_API_KEY]";

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      }),
    });

    if (!res.ok) {
      return `[Ошибка поиска: ${res.status} ${await res.text()}]`;
    }

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

// ── Tool definitions ──────────────────────────────────────────────────────────

// Формат Anthropic (для KIE /claude/v1/messages)
const WEB_SEARCH_TOOL_CLAUDE = {
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

// Формат OpenAI (для KIE /{model}/v1/chat/completions)
const WEB_SEARCH_TOOL_OPENAI = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Поиск актуальной информации в интернете. Используй, когда нужны свежие данные, новости, текущие события или информация, которая могла измениться после твоего обучения.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Поисковый запрос" },
      },
      required: ["query"],
    },
  },
};

// ── Chat Routes ───────────────────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {
  // Создать новый чат
  app.post("/api/chat/new", async (request, reply) => {
    const body = request.body as {
      module?: string;
      model?: string;
      title?: string;
      project_id?: string;
    };
    const module = body?.module?.trim() || "claude";
    const model = body?.model?.trim() || "claude-sonnet-4-6-v1messages";
    const title = body?.title?.trim() || "Новый чат";
    const project_id = body?.project_id?.trim() || null;

    const result = await dbQuery(
      `INSERT INTO chats (module, model, title, project_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [module, model, title, project_id]
    );

    return { ok: true, chat: result.rows[0] };
  });

  // Получить список чатов модуля
  app.get("/api/chat/list", async (request) => {
    const query = request.query as { module?: string; project_id?: string };
    const module = query?.module?.trim() || "claude";
    const project_id = query?.project_id?.trim() || null;

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

  // Получить историю сообщений чата
  app.get("/api/chat/:chatId/messages", async (request) => {
    const { chatId } = request.params as { chatId: string };
    const result = await dbQuery(
      `SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
      [chatId]
    );
    return { ok: true, messages: result.rows };
  });

  // Обновить чат (model / title / project_id)
  app.patch("/api/chat/:chatId", async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const body = request.body as {
      model?: string;
      title?: string;
      project_id?: string | null;
    };

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.model !== undefined) {
      updates.push(`model = $${idx++}`);
      values.push(body.model.trim());
    }
    if (body.title !== undefined) {
      updates.push(`title = $${idx++}`);
      values.push(body.title.trim());
    }
    if ("project_id" in body) {
      updates.push(`project_id = $${idx++}`);
      values.push(body.project_id ?? null);
    }

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

  // Отправить сообщение
  app.post("/api/chat/:chatId/send", async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const body = request.body as {
      message?: string;
      files?: Array<{ dataUrl: string; mimeType: string; name: string }>;
    };
    const userMessage = body?.message?.trim() || "";
    const attachedFiles = body?.files ?? [];
    const apiKey = process.env.KIE_API_KEY;

    if (!apiKey)
      return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });

    if (!userMessage && attachedFiles.length === 0)
      return reply.status(400).send({ ok: false, error: "Пустое сообщение" });

    // ── Получить данные чата ─────────────────────────────────────────────────
    const chatResult = await dbQuery(`SELECT * FROM chats WHERE id = $1`, [chatId]);
    if (chatResult.rows.length === 0)
      return reply.status(404).send({ ok: false, error: "Чат не найден" });
    const chat = chatResult.rows[0];

    // ── Сохранить сообщение пользователя ────────────────────────────────────
    const savedContent =
      attachedFiles.length > 0
        ? `${userMessage}${userMessage ? "\n" : ""}[Файлы: ${attachedFiles.map((f) => f.name).join(", ")}]`
        : userMessage;
    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)`,
      [chatId, "user", savedContent]
    );

    // Обновить заголовок при первом сообщении
    const countResult = await dbQuery(
      `SELECT COUNT(*) FROM chat_messages WHERE chat_id = $1`,
      [chatId]
    );
    if (Number(countResult.rows[0].count) === 1) {
      const shortTitle = (userMessage || attachedFiles[0]?.name || "Новый чат").slice(0, 50);
      await dbQuery(`UPDATE chats SET title = $1 WHERE id = $2`, [shortTitle, chatId]);
    }

    // ── Собрать историю ──────────────────────────────────────────────────────
    const historyResult = await dbQuery(
      `SELECT role, content FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
      [chatId]
    );
    const historyRows: Array<{ role: string; content: string }> = historyResult.rows;

    // ── Глобальная память движка ─────────────────────────────────────────────
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

    // ── System prompt из проекта ─────────────────────────────────────────────
    let systemText: string | undefined;
    let projectContextImages: Array<{ name: string; mimeType: string; dataUrl: string }> = [];

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

        const files: Array<{ name: string; mimeType: string; dataUrl: string }> =
          Array.isArray(proj.context_files) ? proj.context_files : [];

        for (const file of files) {
          if (!file.mimeType.startsWith("image/")) {
            const base64 = file.dataUrl.split(",")[1] ?? "";
            const decoded = Buffer.from(base64, "base64").toString("utf-8");
            parts.push(`[Файл контекста: ${file.name}]\n${decoded}`);
          }
        }

        if (parts.length > 0) systemText = parts.join("\n\n");
        projectContextImages = files.filter((f) => f.mimeType.startsWith("image/"));
      }
    } else if (globalParts.length > 0) {
      systemText = globalParts.join("\n\n");
    }

    // ── Определить тип API ───────────────────────────────────────────────────
    // Модели заканчивающиеся на "v1messages" → KIE /claude/v1/messages (Anthropic формат)
    // Остальные → KIE /{model}/v1/chat/completions (OpenAI формат)
    const isKieClaude = chat.model?.endsWith("v1messages");
    const hasSearchKey = !!process.env.TAVILY_API_KEY;

    try {
      let assistantText: string | undefined;

      if (isKieClaude) {
        // ════════════════════════════════════════════════════════════════════
        // KIE Anthropic Messages API  →  POST /claude/v1/messages
        // Docs: https://docs.kie.ai/30749677e0
        // ════════════════════════════════════════════════════════════════════

        // Строим массив сообщений в формате Anthropic.
        // Контент — строка (как в примерах KIE docs), кроме случаев с файлами.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const claudeMessages: Array<{ role: string; content: any }> = [];

        // Если есть контекстные изображения — вставляем их как первую пару
        if (projectContextImages.length > 0) {
          const imageContent: Array<Record<string, unknown>> = [
            { type: "text", text: "Вот файлы контекста проекта, учитывай их во всех ответах:" },
          ];
          for (const file of projectContextImages) {
            const base64data = file.dataUrl.split(",")[1] ?? file.dataUrl;
            imageContent.push({
              type: "image",
              source: { type: "base64", media_type: file.mimeType, data: base64data },
            });
          }
          claudeMessages.push({ role: "user", content: imageContent });
          claudeMessages.push({
            role: "assistant",
            content: "Понял, учту эти материалы как контекст проекта.",
          });
        }

        // История сообщений
        historyRows.forEach((row, index) => {
          const isLastUser = index === historyRows.length - 1 && row.role === "user";

          if (isLastUser && attachedFiles.length > 0) {
            // Последнее сообщение пользователя с прикреплёнными файлами
            const contentItems: Array<Record<string, unknown>> = [];
            if (userMessage) contentItems.push({ type: "text", text: userMessage });
            for (const file of attachedFiles) {
              if (file.mimeType.startsWith("image/")) {
                const base64data = file.dataUrl.split(",")[1] ?? file.dataUrl;
                contentItems.push({
                  type: "image",
                  source: { type: "base64", media_type: file.mimeType, data: base64data },
                });
              } else {
                const base64 = file.dataUrl.split(",")[1] ?? "";
                const decoded = Buffer.from(base64, "base64").toString("utf-8");
                contentItems.push({ type: "text", text: `[Файл: ${file.name}]\n${decoded}` });
              }
            }
            claudeMessages.push({ role: row.role, content: contentItems });
          } else {
            // Обычное текстовое сообщение — строка (формат из KIE docs)
            claudeMessages.push({ role: row.role, content: row.content });
          }
        });

        // Цикл tool_use согласно Anthropic spec
        const MAX_LOOPS = 5;
        for (let loop = 0; loop < MAX_LOOPS; loop++) {
          const requestBody: Record<string, unknown> = {
            model: chat.model,
            messages: claudeMessages,
            stream: false,
            ...(systemText ? { system: systemText } : {}),
            ...(hasSearchKey ? { tools: [WEB_SEARCH_TOOL_CLAUDE] } : {}),
          };

          console.log(`[KIE Claude] REQUEST loop=${loop}:`, JSON.stringify(requestBody, null, 2));

          const resp = await fetch(`${KIE_BASE_URL}/claude/v1/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          const data = await resp.json() as {
            stop_reason?: string;
            content?: Array<{
              type: string;
              text?: string;
              id?: string;
              name?: string;
              input?: Record<string, unknown>;
            }>;
            error?: { message?: string };
            code?: number;
            msg?: string;
          };

          console.log(`[KIE Claude] RESPONSE loop=${loop}:`, resp.status, JSON.stringify(data));

          // KIE может вернуть HTTP 200, но с {code: 500} внутри
          if (!resp.ok || data.code === 500) {
            return reply.status(500).send({
              ok: false,
              error: data?.msg || data?.error?.message || "KIE Claude вернул ошибку",
              debug: { status: resp.status, body: data },
            });
          }

          const toolUseBlocks = (data.content ?? []).filter((b) => b.type === "tool_use");

          // Финальный ответ — нет tool_use или поиск недоступен
          if (toolUseBlocks.length === 0 || data.stop_reason !== "tool_use" || !hasSearchKey) {
            assistantText = data.content?.find((b) => b.type === "text")?.text;
            if (!assistantText) {
              return reply.status(500).send({
                ok: false,
                error: "KIE Claude не вернул текстовый ответ",
                debug: { status: resp.status, body: data },
              });
            }
            break;
          }

          // Добавляем ответ ассистента с tool_use блоками в историю
          claudeMessages.push({ role: "assistant", content: data.content });

          // Выполняем инструменты и собираем tool_result
          const toolResults: Array<Record<string, unknown>> = [];
          for (const block of toolUseBlocks) {
            if (block.name === "web_search") {
              const query = (block.input?.query as string) || "";
              console.log(`[web_search] query: "${query}"`);
              const searchResult = await webSearch(query);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: searchResult,
              });
            }
          }

          // Возвращаем результаты в Anthropic-формате
          claudeMessages.push({ role: "user", content: toolResults });
        }

        assistantText ??= "[Не удалось получить ответ]";

      } else {
        // ════════════════════════════════════════════════════════════════════
        // KIE OpenAI-compatible API  →  POST /{model}/v1/chat/completions
        // ════════════════════════════════════════════════════════════════════

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oaiMessages: Array<{ role: string; content: any; tool_calls?: any; tool_call_id?: string; name?: string }> = [];

        if (systemText) oaiMessages.push({ role: "system", content: systemText });

        // Контекстные изображения как первая пара
        if (projectContextImages.length > 0) {
          const imageContent: Array<Record<string, unknown>> = [
            { type: "text", text: "Вот файлы контекста проекта, учитывай их во всех ответах:" },
          ];
          for (const file of projectContextImages) {
            imageContent.push({ type: "image_url", image_url: { url: file.dataUrl } });
          }
          oaiMessages.push({ role: "user", content: imageContent });
          oaiMessages.push({ role: "assistant", content: "Понял, учту эти материалы как контекст проекта." });
        }

        historyRows.forEach((row, index) => {
          const isLastUser = index === historyRows.length - 1 && row.role === "user";

          if (isLastUser && attachedFiles.length > 0) {
            const contentItems: Array<Record<string, unknown>> = [];
            if (userMessage) contentItems.push({ type: "text", text: userMessage });
            for (const file of attachedFiles) {
              if (file.mimeType.startsWith("image/")) {
                contentItems.push({ type: "image_url", image_url: { url: file.dataUrl } });
              } else {
                const base64 = file.dataUrl.split(",")[1] ?? "";
                const decoded = Buffer.from(base64, "base64").toString("utf-8");
                contentItems.push({ type: "text", text: `[Файл: ${file.name}]\n${decoded}` });
              }
            }
            oaiMessages.push({ role: row.role, content: contentItems });
          } else {
            oaiMessages.push({ role: row.role, content: row.content });
          }
        });

        const MAX_LOOPS = 5;
        for (let loop = 0; loop < MAX_LOOPS; loop++) {
          const requestBody: Record<string, unknown> = {
            messages: oaiMessages,
            stream: false,
            ...(hasSearchKey ? { tools: [WEB_SEARCH_TOOL_OPENAI], tool_choice: "auto" } : {}),
          };

          console.log(`[KIE OAI] REQUEST loop=${loop}:`, JSON.stringify(requestBody, null, 2));

          const resp = await fetch(`${KIE_BASE_URL}/${chat.model}/v1/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          const data = await resp.json() as {
            choices?: Array<{
              message?: {
                content?: string;
                tool_calls?: Array<{
                  id: string;
                  type: string;
                  function: { name: string; arguments: string };
                }>;
              };
              finish_reason?: string;
            }>;
            error?: { message?: string };
          };

          console.log(`[KIE OAI] RESPONSE loop=${loop}:`, resp.status, JSON.stringify(data));

          if (!resp.ok) {
            return reply.status(500).send({
              ok: false,
              error: data?.error?.message || "KIE не вернул ответ",
              debug: { status: resp.status, body: data },
            });
          }

          const choice = data.choices?.[0];
          const toolCalls = choice?.message?.tool_calls ?? [];

          if (toolCalls.length === 0 || choice?.finish_reason !== "tool_calls" || !hasSearchKey) {
            assistantText = choice?.message?.content;
            if (!assistantText) {
              return reply.status(500).send({
                ok: false,
                error: "KIE не вернул ответ",
                debug: { status: resp.status, body: data },
              });
            }
            break;
          }

          // Добавляем сообщение ассистента с tool_calls
          oaiMessages.push({
            role: "assistant",
            content: choice.message?.content ?? null,
            tool_calls: toolCalls,
          });

          // Выполняем функции
          for (const toolCall of toolCalls) {
            if (toolCall.function.name === "web_search") {
              let args: { query?: string } = {};
              try { args = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }
              const query = args.query || "";
              console.log(`[web_search] query: "${query}"`);
              const searchResult = await webSearch(query);
              oaiMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: "web_search",
                content: searchResult,
              });
            }
          }
        }

        assistantText ??= "[Не удалось получить ответ]";
      }

      // ── Сохранить ответ и вернуть ────────────────────────────────────────
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
