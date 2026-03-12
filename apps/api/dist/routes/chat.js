import { dbQuery } from "../lib/db.js";
const KIE_BASE_URL = "https://api.kie.ai";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
export async function chatRoutes(app) {
    // Создать новый чат
    app.post("/api/chat/new", async (request, reply) => {
        const body = request.body;
        const module = body?.module?.trim() || "claude";
        const model = body?.model?.trim() || "claude-opus-4-5";
        const title = body?.title?.trim() || "Новый чат";
        const project_id = body?.project_id?.trim() || null;
        const result = await dbQuery(`INSERT INTO chats (module, model, title, project_id) VALUES ($1, $2, $3, $4) RETURNING *`, [module, model, title, project_id]);
        return { ok: true, chat: result.rows[0] };
    });
    // Получить список чатов модуля
    app.get("/api/chat/list", async (request) => {
        const query = request.query;
        const module = query?.module?.trim() || "claude";
        const project_id = query?.project_id?.trim() || null;
        let result;
        if (project_id) {
            result = await dbQuery(`SELECT * FROM chats WHERE module = $1 AND project_id = $2 ORDER BY created_at DESC`, [module, project_id]);
        }
        else {
            result = await dbQuery(`SELECT * FROM chats WHERE module = $1 ORDER BY created_at DESC`, [module]);
        }
        return { ok: true, chats: result.rows };
    });
    // Получить историю сообщений чата
    app.get("/api/chat/:chatId/messages", async (request, reply) => {
        const params = request.params;
        const result = await dbQuery(`SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`, [params.chatId]);
        return { ok: true, messages: result.rows };
    });
    // Удалить чат
    app.delete("/api/chat/:chatId", async (request, reply) => {
        const params = request.params;
        await dbQuery(`DELETE FROM chats WHERE id = $1`, [params.chatId]);
        return { ok: true };
    });
    // Отправить сообщение — основной маршрут
    app.post("/api/chat/:chatId/send", async (request, reply) => {
        const params = request.params;
        const body = request.body;
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
        await dbQuery(`INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)`, [params.chatId, "user", savedContent]);
        // Обновить заголовок чата если это первое сообщение
        const countResult = await dbQuery(`SELECT COUNT(*) FROM chat_messages WHERE chat_id = $1`, [params.chatId]);
        if (Number(countResult.rows[0].count) === 1) {
            const shortTitle = (userMessage || attachedFiles[0]?.name || "Новый чат").slice(0, 50);
            await dbQuery(`UPDATE chats SET title = $1 WHERE id = $2`, [shortTitle, params.chatId]);
        }
        // Загрузить всю историю для контекста
        const historyResult = await dbQuery(`SELECT role, content FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`, [params.chatId]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages = [];
        // Добавить system prompt из проекта, если есть
        if (chat.project_id) {
            const projectResult = await dbQuery(`SELECT system_prompt, style, memory FROM projects WHERE id = $1`, [chat.project_id]);
            if (projectResult.rows.length > 0) {
                const proj = projectResult.rows[0];
                const parts = [];
                if (proj.system_prompt)
                    parts.push(proj.system_prompt);
                if (proj.style)
                    parts.push(`Стиль общения: ${proj.style}`);
                if (proj.memory)
                    parts.push(`Память проекта:\n${proj.memory}`);
                if (parts.length > 0) {
                    messages.push({ role: "system", content: parts.join("\n\n") });
                }
            }
        }
        const historyRows = historyResult.rows;
        historyRows.forEach((row, index) => {
            // Последнее сообщение пользователя — добавляем прикреплённые файлы
            const isLastUserMsg = index === historyRows.length - 1 && row.role === "user";
            if (isLastUserMsg && attachedFiles.length > 0) {
                const contentItems = [];
                if (userMessage)
                    contentItems.push({ type: "text", text: userMessage });
                for (const file of attachedFiles) {
                    if (file.mimeType.startsWith("image/")) {
                        contentItems.push({ type: "image_url", image_url: { url: file.dataUrl } });
                    }
                    else {
                        // Текстовые файлы — декодируем base64 и вставляем как текст
                        const base64 = file.dataUrl.split(",")[1] ?? "";
                        const decoded = Buffer.from(base64, "base64").toString("utf-8");
                        contentItems.push({ type: "text", text: `[Файл: ${file.name}]\n${decoded}` });
                    }
                }
                messages.push({ role: row.role, content: contentItems });
            }
            else {
                messages.push({ role: row.role, content: [{ type: "text", text: row.content }] });
            }
        });
        // Роутинг: Claude → Anthropic API, остальные → KIE
        const isClaudeModel = chat.model?.startsWith("claude-");
        try {
            let assistantText;
            if (isClaudeModel) {
                // ── Anthropic API ──────────────────────────────────────────
                const anthropicKey = process.env.ANTHROPIC_API_KEY;
                if (!anthropicKey) {
                    return reply.status(500).send({ ok: false, error: "Не задан ANTHROPIC_API_KEY" });
                }
                // Anthropic требует system отдельно, убираем system-роль из messages
                let systemPrompt;
                const anthropicMessages = [];
                for (const msg of messages) {
                    if (msg.role === "system") {
                        // Собираем system в строку
                        if (Array.isArray(msg.content)) {
                            systemPrompt = msg.content
                                .map((c) => c.text ?? "").join("\n");
                        }
                        else {
                            systemPrompt = String(msg.content);
                        }
                    }
                    else {
                        // Конвертируем image_url (OpenAI) → image source (Anthropic)
                        if (Array.isArray(msg.content)) {
                            const converted = msg.content.map((c) => {
                                if (c.type === "image_url" && c.image_url) {
                                    const url = c.image_url.url;
                                    const [meta, data] = url.split(",");
                                    const mimeType = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
                                    return { type: "image", source: { type: "base64", media_type: mimeType, data } };
                                }
                                return c;
                            });
                            anthropicMessages.push({ role: msg.role, content: converted });
                        }
                        else {
                            anthropicMessages.push(msg);
                        }
                    }
                }
                const anthropicBody = {
                    model: chat.model,
                    max_tokens: 8096,
                    messages: anthropicMessages,
                };
                if (systemPrompt)
                    anthropicBody.system = systemPrompt;
                const anthropicResponse = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
                    method: "POST",
                    headers: {
                        "x-api-key": anthropicKey,
                        "anthropic-version": ANTHROPIC_VERSION,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(anthropicBody),
                });
                const anthropicData = await anthropicResponse.json();
                if (!anthropicResponse.ok || !anthropicData.content?.[0]?.text) {
                    console.error("Anthropic error:", anthropicResponse.status, JSON.stringify(anthropicData));
                    return reply.status(500).send({
                        ok: false,
                        error: anthropicData.error?.message || "Anthropic не вернул ответ",
                        debug: { status: anthropicResponse.status, body: anthropicData },
                    });
                }
                assistantText = anthropicData.content[0].text;
            }
            else {
                // ── KIE API ────────────────────────────────────────────────
                const kieResponse = await fetch(`${KIE_BASE_URL}/${chat.model}/v1/chat/completions`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ messages, stream: false }),
                });
                const kieData = await kieResponse.json();
                if (!kieResponse.ok || !kieData?.choices?.[0]?.message?.content) {
                    console.error("KIE error:", kieResponse.status, JSON.stringify(kieData));
                    return reply.status(500).send({
                        ok: false,
                        error: kieData?.error?.message || "KIE не вернул ответ",
                        debug: { status: kieResponse.status, body: kieData },
                    });
                }
                assistantText = kieData.choices[0].message.content;
            }
            // Сохранить ответ ассистента
            await dbQuery(`INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)`, [params.chatId, "assistant", assistantText]);
            return { ok: true, reply: assistantText };
        }
        catch (e) {
            console.error("Chat send error:", e);
            return reply.status(500).send({ ok: false, error: "Ошибка при обращении к API" });
        }
    });
}
