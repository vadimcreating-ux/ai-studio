import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";

const KIE_BASE_URL = "https://api.kie.ai";

// ── Web Search (Tavily) ──────────────────────────────────────────────────────

const WEB_SEARCH_TOOL_CLAUDE = {
  name: "web_search",
  description: "Поиск актуальной информации в интернете. Используй, когда нужны свежие данные, новости, текущие события или информация, которая могла измениться после твоего обучения.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Поисковый запрос",
      },
    },
    required: ["query"],
  },
};

const WEB_SEARCH_TOOL_OPENAI = {
  type: "function",
  function: {
    name: "web_search",
    description: "Поиск актуальной информации в интернете. Используй, когда нужны свежие данные, новости, текущие события или информация, которая могла измениться после твоего обучения.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Поисковый запрос",
        },
      },
      required: ["query"],
    },
  },
};

async function webSearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return `[Поиск недоступен: не задан TAVILY_API_KEY]`;

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
      const err = await res.text();
      return `[Ошибка поиска: ${res.status} ${err}]`;
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

// ── Chat Routes ──────────────────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {
  // Создать новый чат
  app.post("/api/chat/new", async (request, reply) => {
    const body = request.body as { module?: string; model?: string; title?: string; project_id?: string };
    const module = body?.module?.trim() || "claude";
    const model = body?.model?.trim() || "claude-opus-4-5";
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

    let result;
    if (project_id) {
      result = await dbQuery(
        `SELECT * FROM chats WHERE module = $1 AND project_id = $2 ORDER BY created_at DESC`,
        [module, project_id]
      );
    } else {
      result = await dbQuery(
        `SELECT * FROM chats WHERE module = $1 ORDER BY created_at DESC`,
        [module]
      );
    }

    return { ok: true, chats: result.rows };
  });

  // Получить историю сообщений чата
  app.get("/api/chat/:chatId/messages", async (request, reply) => {
    const params = request.params as { chatId: string };

    const result = await dbQuery(
      `SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
      [params.chatId]
    );

    return { ok: true, messages: result.rows };
  });

  // Обновить чат (model / title / project_id)
  app.patch("/api/chat/:chatId", async (request, reply) => {
    const params = request.params as { chatId: string };
    const body = request.body as { model?: string; title?: string; project_id?: string | null };

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.model !== undefined) { updates.push(`model = $${idx++}`); values.push(body.model.trim()); }
    if (body.title !== undefined) { updates.push(`title = $${idx++}`); values.push(body.title.trim()); }
    if ("project_id" in body) { updates.push(`project_id = $${idx++}`); values.push(body.project_id ?? null); }

    if (updates.length === 0) return reply.status(400).send({ ok: false, error: "Нечего обновлять" });

    values.push(params.chatId);
    const result = await dbQuery(
      `UPDATE chats SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return { ok: true, chat: result.rows[0] };
  });

  // Удалить чат
  app.delete("/api/chat/:chatId", async (request, reply) => {
    const params = request.params as { chatId: string };

    await dbQuery(`DELETE FROM chats WHERE id = $1`, [params.chatId]);

    return { ok: true };
  });

  // Отправить сообщение — основной маршрут
  app.post("/api/chat/:chatId/send", async (request, reply) => {
    const params = request.params as { chatId: string };
    const body = request.body as {
      message?: string;
      files?: Array<{ dataUrl: string; mimeType: string; name: string }>;
    };
    const userMessage = body?.message?.trim() || "";
    const attachedFiles = body?.files ?? [];
    const apiKey = process.env.KIE_API_KEY;

    if (!apiKey) {
      return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    }

    if (!userMessage && attachedFiles.length === 0) {
      return reply.status(400).send({ ok: false, error: "Пустое сообщение" });
    }

    // Получить данные чата
    const chatResult = await dbQuery(`SELECT * FROM chats WHERE id = $1`, [params.chatId]);
    if (chatResult.rows.length === 0) {
      return reply.status(404).send({ ok: false, error: "Чат не найден" });
    }
    const chat = chatResult.rows[0];

    // Сохранить сообщение пользователя (текст + имена файлов для истории)
    const savedContent = attachedFiles.length > 0
      ? `${userMessage}${userMessage ? "\n" : ""}[Файлы: ${attachedFiles.map(f => f.name).join(", ")}]`
      : userMessage;
    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)`,
      [params.chatId, "user", savedContent]
    );

    // Обновить заголовок чата если это первое сообщение
    const countResult = await dbQuery(
      `SELECT COUNT(*) FROM chat_messages WHERE chat_id = $1`,
      [params.chatId]
    );
    if (Number(countResult.rows[0].count) === 1) {
      const shortTitle = (userMessage || attachedFiles[0]?.name || "Новый чат").slice(0, 50);
      await dbQuery(`UPDATE chats SET title = $1 WHERE id = $2`, [shortTitle, params.chatId]);
    }

    // Загрузить всю историю для контекста
    const historyResult = await dbQuery(
      `SELECT role, content FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
      [params.chatId]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: Array<{ role: string; content: any }> = [];

    // Глобальная память движка (поверх всего)
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

    // Добавить system prompt из проекта, если есть
    let projectContextFiles: Array<{ name: string; mimeType: string; dataUrl: string }> = [];
    if (chat.project_id) {
      const projectResult = await dbQuery(
        `SELECT system_prompt, style, memory, context_files FROM projects WHERE id = $1`,
        [chat.project_id]
      );
      if (projectResult.rows.length > 0) {
        const proj = projectResult.rows[0];
        const parts: string[] = [];
        if (proj.system_prompt) parts.push(proj.system_prompt);
        if (proj.style) parts.push(`Стиль общения: ${proj.style}`);
        if (proj.memory) parts.push(`Контекст проекта:\n${proj.memory}`);

        // Текстовые файлы — добавляем содержимое прямо в system prompt
        const files: Array<{ name: string; mimeType: string; dataUrl: string }> =
          Array.isArray(proj.context_files) ? proj.context_files : [];
        for (const file of files) {
          if (!file.mimeType.startsWith("image/")) {
            const base64 = file.dataUrl.split(",")[1] ?? "";
            const decoded = Buffer.from(base64, "base64").toString("utf-8");
            parts.push(`[Файл контекста: ${file.name}]\n${decoded}`);
          }
        }

        const allParts = [...globalParts, ...parts];
        if (allParts.length > 0) {
          messages.push({ role: "system", content: allParts.join("\n\n") });
        }

        // Изображения — сохраняем для инжекции в виде user/assistant пары
        projectContextFiles = files.filter((f) => f.mimeType.startsWith("image/"));
      }
    } else if (globalParts.length > 0) {
      // Нет проекта, но есть глобальная память
      messages.push({ role: "system", content: globalParts.join("\n\n") });
    }

    // Если есть контекстные изображения — добавляем их как user/assistant пару до истории
    if (projectContextFiles.length > 0) {
      const imageItems: Array<Record<string, unknown>> = [
        { type: "text", text: "Вот файлы контекста проекта, учитывай их во всех ответах:" },
      ];
      for (const file of projectContextFiles) {
        imageItems.push({ type: "image_url", image_url: { url: file.dataUrl } });
      }
      messages.push({ role: "user", content: imageItems });
      messages.push({ role: "assistant", content: [{ type: "text", text: "Понял, учту эти материалы как контекст проекта." }] });
    }

    const historyRows: Array<{ role: string; content: string }> = historyResult.rows;
    historyRows.forEach((row, index) => {
      // Последнее сообщение пользователя — добавляем прикреплённые файлы
      const isLastUserMsg = index === historyRows.length - 1 && row.role === "user";
      if (isLastUserMsg && attachedFiles.length > 0) {
        const contentItems: Array<Record<string, unknown>> = [];
        if (userMessage) contentItems.push({ type: "text", text: userMessage });
        for (const file of attachedFiles) {
          if (file.mimeType.startsWith("image/")) {
            contentItems.push({ type: "image_url", image_url: { url: file.dataUrl } });
          } else {
            // Текстовые файлы — декодируем base64 и вставляем как текст
            const base64 = file.dataUrl.split(",")[1] ?? "";
            const decoded = Buffer.from(base64, "base64").toString("utf-8");
            contentItems.push({ type: "text", text: `[Файл: ${file.name}]\n${decoded}` });
          }
        }
        messages.push({ role: row.role, content: contentItems });
      } else {
        messages.push({ role: row.role, content: [{ type: "text", text: row.content }] });
      }
    });

    // claude-*-v1messages → KIE Anthropic Messages API, остальные → KIE chat/completions
    const isKieClaude = chat.model?.endsWith("v1messages");
    const hasSearchKey = !!process.env.TAVILY_API_KEY;

    // Эвристика: нужен ли поиск для этого сообщения
    const SEARCH_PATTERN = /\b(сегодня|вчера|сейчас|последн|новост|актуальн|текущ|2024|2025|2026|цена|курс|погода|событи|недавн|only|today|now|latest|current|news|recent|price|weather)\b/i;
    const needsSearch = hasSearchKey && SEARCH_PATTERN.test(userMessage);

    // Если поиск нужен — делаем его заранее и инжектируем в контекст
    if (needsSearch) {
      console.log(`[web_search] pre-search for: "${userMessage.slice(0, 100)}"`);
      const searchResult = await webSearch(userMessage.slice(0, 200));
      if (searchResult && !searchResult.startsWith("[")) {
        // Добавляем результаты поиска в системный промпт
        const existingSystem = messages.find((m) => m.role === "system");
        const searchNote = `Актуальные данные из интернета (используй их в ответе):\n${searchResult}`;
        if (existingSystem) {
          existingSystem.content = `${existingSystem.content}\n\n${searchNote}`;
        } else {
          messages.unshift({ role: "system", content: searchNote });
        }
      }
    }

    try {
      let assistantText: string;

      if (isKieClaude) {
        // ── KIE Anthropic Messages API ─────────────────────────────────────────

        const systemMsg = messages.find((m) => m.role === "system");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const claudeMessages: Array<{ role: string; content: any }> = messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role,
            // KIE Claude принимает только строки в content — склеиваем текстовые блоки
            content: Array.isArray(m.content)
              ? m.content.map((b: any) => (b.type === "text" ? b.text : "")).join("")
              : m.content,
          }));

        const systemText = systemMsg
          ? (typeof systemMsg.content === "string" ? systemMsg.content : JSON.stringify(systemMsg.content))
          : undefined;

        // Согласно docs.kie.ai: model, messages, stream — без tools (KIE не поддерживает)
        const requestBody: Record<string, unknown> = {
          model: chat.model,
          messages: claudeMessages,
          stream: false,
          ...(systemText ? { system: systemText } : {}),
        };

        console.log(`KIE Claude REQUEST:`, JSON.stringify(requestBody, null, 2));

        const kieClaudeResponse = await fetch(
          `${KIE_BASE_URL}/claude/v1/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );

        const kieClaudeData = await kieClaudeResponse.json() as {
          stop_reason?: string;
          content?: Array<{ type: string; text?: string }>;
          error?: { message?: string };
          code?: number;
          msg?: string;
        };

        console.log(`KIE Claude response:`, kieClaudeResponse.status, JSON.stringify(kieClaudeData));

        // KIE может вернуть HTTP 200, но с {code: 500, msg: "..."} внутри
        if (!kieClaudeResponse.ok || kieClaudeData.code === 500) {
          return reply.status(500).send({
            ok: false,
            error: kieClaudeData?.msg || kieClaudeData?.error?.message || "KIE Claude не вернул ответ",
            debug: { status: kieClaudeResponse.status, body: kieClaudeData },
          });
        }

        const claudeText = kieClaudeData?.content?.find((b) => b.type === "text")?.text;
        if (!claudeText) {
          return reply.status(500).send({
            ok: false,
            error: "KIE Claude не вернул текстовый ответ",
            debug: { status: kieClaudeResponse.status, body: kieClaudeData },
          });
        }
        assistantText = claudeText;

      } else {
        // ── KIE chat/completions (GPT, Gemini) ────────────────────────────────

        const requestBody: Record<string, unknown> = {
          messages,
          stream: false,
        };

        const kieResponse = await fetch(
          `${KIE_BASE_URL}/${chat.model}/v1/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );

        const kieData = await kieResponse.json() as {
          choices?: Array<{ message?: { content?: string } }>;
          error?: { message?: string };
        };

        if (!kieResponse.ok) {
          console.error("KIE error:", kieResponse.status, JSON.stringify(kieData));
          return reply.status(500).send({
            ok: false,
            error: kieData?.error?.message || "KIE не вернул ответ",
            debug: { status: kieResponse.status, body: kieData },
          });
        }

        const content = kieData.choices?.[0]?.message?.content;
        if (!content) {
          return reply.status(500).send({
            ok: false,
            error: "KIE не вернул ответ",
            debug: { status: kieResponse.status, body: kieData },
          });
        }
        assistantText = content;
      }

      // Сохранить ответ ассистента
      await dbQuery(
        `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)`,
        [params.chatId, "assistant", assistantText]
      );

      return { ok: true, reply: assistantText };
    } catch (e) {
      console.error("Chat send error:", e);
      return reply.status(500).send({ ok: false, error: "Ошибка при обращении к API" });
    }
  });
}
