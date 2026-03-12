import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";

const KIE_BASE_URL = "https://api.kie.ai";

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

    // Добавить system prompt из проекта, если есть
    if (chat.project_id) {
      const projectResult = await dbQuery(
        `SELECT system_prompt, style, memory FROM projects WHERE id = $1`,
        [chat.project_id]
      );
      if (projectResult.rows.length > 0) {
        const proj = projectResult.rows[0];
        const parts: string[] = [];
        if (proj.system_prompt) parts.push(proj.system_prompt);
        if (proj.style) parts.push(`Стиль общения: ${proj.style}`);
        if (proj.memory) parts.push(`Память проекта:\n${proj.memory}`);
        if (parts.length > 0) {
          messages.push({ role: "system", content: parts.join("\n\n") });
        }
      }
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

    // Запрос к kie.ai (без стриминга для простоты)
    try {
      const kieResponse = await fetch(
        `${KIE_BASE_URL}/${chat.model}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages,
            stream: false,
          }),
        }
      );

      const kieData = await kieResponse.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };

      if (!kieResponse.ok || !kieData?.choices?.[0]?.message?.content) {
        console.error("KIE error:", kieResponse.status, JSON.stringify(kieData));
        return reply.status(500).send({
          ok: false,
          error: kieData?.error?.message || "KIE не вернул ответ",
          debug: { status: kieResponse.status, body: kieData },
        });
      }

      const assistantText = kieData.choices[0].message.content;

      // Сохранить ответ ассистента
      await dbQuery(
        `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)`,
        [params.chatId, "assistant", assistantText]
      );

      return { ok: true, reply: assistantText };
    } catch {
      return reply.status(500).send({ ok: false, error: "Ошибка при обращении к KIE" });
    }
  });
}
