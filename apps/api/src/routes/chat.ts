import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";

const KIE_BASE_URL = "https://api.kie.ai";
const CLAUDE_MODEL = "claude-sonnet-4-5";

export async function chatRoutes(app: FastifyInstance) {

  app.post("/api/chat/new", async (request) => {
    const body = request.body as {
      module?: string; model?: string; title?: string; project_id?: string;
    };
    const result = await dbQuery(
      `INSERT INTO chats (module, model, title, project_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        body?.module?.trim() || "claude",
        body?.model?.trim() || CLAUDE_MODEL,
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

  app.post("/api/chat/:chatId/send", async (request, reply) => {
    const { chatId } = request.params as { chatId: string };
    const body = request.body as {
      message: string;
      files?: Array<{ dataUrl: string; mimeType: string; name: string }>;
    };

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    }

    const userText = body.message?.trim();
    if (!userText) {
      return reply.status(400).send({ ok: false, error: "Пустое сообщение" });
    }

    // Load chat info + engine settings (system prompt)
    const [chatRes, settingsRes, historyRes] = await Promise.all([
      dbQuery(`SELECT * FROM chats WHERE id = $1`, [chatId]),
      dbQuery(`SELECT * FROM engine_settings WHERE engine = 'claude'`, []),
      dbQuery(`SELECT role, content FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`, [chatId]),
    ]);

    if (chatRes.rows.length === 0) {
      return reply.status(404).send({ ok: false, error: "Чат не найден" });
    }

    const settings = settingsRes.rows[0];

    // Build system prompt from engine settings
    const systemParts: string[] = [];
    if (settings?.about?.trim())        systemParts.push(settings.about.trim());
    if (settings?.instructions?.trim()) systemParts.push(settings.instructions.trim());
    if (settings?.memory?.trim())       systemParts.push(`Память:\n${settings.memory.trim()}`);

    // Build messages array
    type KieMessage = { role: string; content: string | unknown[] };
    const messages: KieMessage[] = [];

    if (systemParts.length > 0) {
      messages.push({ role: "system", content: systemParts.join("\n\n") });
    }

    // History
    for (const row of historyRes.rows) {
      messages.push({ role: row.role, content: row.content });
    }

    // Current user message (with optional images)
    if (body.files && body.files.length > 0) {
      const contentParts: unknown[] = [{ type: "text", text: userText }];
      for (const f of body.files) {
        if (f.mimeType.startsWith("image/")) {
          contentParts.push({ type: "image_url", image_url: { url: f.dataUrl } });
        } else {
          // text files — append content as plain text
          const base64 = f.dataUrl.split(",")[1] ?? "";
          const decoded = Buffer.from(base64, "base64").toString("utf-8");
          contentParts.push({ type: "text", text: `\n\n[${f.name}]\n${decoded}` });
        }
      }
      messages.push({ role: "user", content: contentParts });
    } else {
      messages.push({ role: "user", content: userText });
    }

    // Save user message to DB
    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'user', $2)`,
      [chatId, userText]
    );

    // Call kie.ai Claude Sonnet 4.5
    const kieRes = await fetch(`${KIE_BASE_URL}/${CLAUDE_MODEL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ messages, stream: false, include_thoughts: false }),
    });

    if (!kieRes.ok) {
      const errText = await kieRes.text();
      app.log.error(`kie.ai error ${kieRes.status}: ${errText}`);
      return reply.status(502).send({ ok: false, error: `Ошибка kie.ai: ${kieRes.status}` });
    }

    const data = await kieRes.json() as {
      choices?: Array<{ message?: { content?: string | Array<{ type: string; text?: string }> } }>;
    };

    const rawContent = data.choices?.[0]?.message?.content ?? "";
    const assistantReply = (
      Array.isArray(rawContent)
        ? rawContent.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")
        : rawContent
    ).trim();

    // Save assistant reply to DB
    await dbQuery(
      `INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'assistant', $2)`,
      [chatId, assistantReply]
    );

    return { ok: true, reply: assistantReply };
  });
}
