import { dbQuery } from "../lib/db.js";
const KIE_BASE_URL = "https://api.kie.ai";
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
    // Обновить модель чата
    app.patch("/api/chat/:chatId", async (request, reply) => {
        const params = request.params;
        const body = request.body;
        const model = body?.model?.trim();
        if (!model)
            return reply.status(400).send({ ok: false, error: "model required" });
        const result = await dbQuery(`UPDATE chats SET model = $1 WHERE id = $2 RETURNING *`, [model, params.chatId]);
        return { ok: true, chat: result.rows[0] };
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
        let projectContextFiles = [];
        if (chat.project_id) {
            const projectResult = await dbQuery(`SELECT system_prompt, style, memory, context_files FROM projects WHERE id = $1`, [chat.project_id]);
            if (projectResult.rows.length > 0) {
                const proj = projectResult.rows[0];
                const parts = [];
                if (proj.system_prompt)
                    parts.push(proj.system_prompt);
                if (proj.style)
                    parts.push(`Стиль общения: ${proj.style}`);
                if (proj.memory)
                    parts.push(`Контекст проекта:\n${proj.memory}`);
                // Текстовые файлы — добавляем содержимое прямо в system prompt
                const files = Array.isArray(proj.context_files) ? proj.context_files : [];
                for (const file of files) {
                    if (!file.mimeType.startsWith("image/")) {
                        const base64 = file.dataUrl.split(",")[1] ?? "";
                        const decoded = Buffer.from(base64, "base64").toString("utf-8");
                        parts.push(`[Файл контекста: ${file.name}]\n${decoded}`);
                    }
                }
                if (parts.length > 0) {
                    messages.push({ role: "system", content: parts.join("\n\n") });
                }
                // Изображения — сохраняем для инжекции в виде user/assistant пары
                projectContextFiles = files.filter((f) => f.mimeType.startsWith("image/"));
            }
        }
        // Если есть контекстные изображения — добавляем их как user/assistant пару до истории
        if (projectContextFiles.length > 0) {
            const imageItems = [
                { type: "text", text: "Вот файлы контекста проекта, учитывай их во всех ответах:" },
            ];
            for (const file of projectContextFiles) {
                imageItems.push({ type: "image_url", image_url: { url: file.dataUrl } });
            }
            messages.push({ role: "user", content: imageItems });
            messages.push({ role: "assistant", content: [{ type: "text", text: "Понял, учту эти материалы как контекст проекта." }] });
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
        // Роутинг: claude-*-v1messages → KIE Claude API, остальные → KIE chat/completions
        const isKieClaude = chat.model?.endsWith("v1messages");
        try {
            let assistantText;
            if (isKieClaude) {
                // ── KIE Claude API (/claude/v1/messages) ──────────────────
                // Strip "-v1messages" suffix to get real Anthropic model ID
                const claudeModelId = chat.model.replace(/-v1messages$/, "");
                // Извлекаем system prompt (если есть) и убираем из messages
                const systemMsg = messages.find((m) => m.role === "system");
                // Normalize message content: convert arrays to plain strings for KIE compatibility
                const claudeMessages = messages
                    .filter((m) => m.role !== "system")
                    .map((m) => ({
                    role: m.role,
                    content: Array.isArray(m.content)
                        ? m.content.map((b) => (b.type === "text" ? b.text : "")).join("")
                        : m.content,
                }));
                const kieClaudeResponse = await fetch(`${KIE_BASE_URL}/${claudeModelId}/v1/messages`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: claudeModelId,
                        max_tokens: 4096,
                        messages: claudeMessages,
                        ...(systemMsg ? { system: typeof systemMsg.content === "string" ? systemMsg.content : JSON.stringify(systemMsg.content) } : {}),
                        stream: false,
                    }),
                });
                const kieClaudeData = await kieClaudeResponse.json();
                console.log("KIE Claude raw response:", kieClaudeResponse.status, JSON.stringify(kieClaudeData));
                // Handle KIE error wrapper: {code: 500, msg: "..."}
                if (kieClaudeData?.code !== undefined && kieClaudeData.code !== 200) {
                    return reply.status(500).send({
                        ok: false,
                        error: kieClaudeData.msg || "KIE Claude вернул ошибку",
                        debug: { status: kieClaudeResponse.status, body: kieClaudeData },
                    });
                }
                // Extract content from either wrapped (data.content) or direct (content) format
                const contentBlocks = kieClaudeData?.data?.content ?? kieClaudeData?.content ?? [];
                const claudeText = contentBlocks.find((b) => b.type === "text")?.text;
                if (!kieClaudeResponse.ok || !claudeText) {
                    console.error("KIE Claude no text:", kieClaudeResponse.status, JSON.stringify(kieClaudeData));
                    return reply.status(500).send({
                        ok: false,
                        error: kieClaudeData?.msg || "KIE Claude не вернул ответ",
                        debug: { status: kieClaudeResponse.status, body: kieClaudeData },
                    });
                }
                assistantText = claudeText;
            }
            else {
                // ── KIE chat/completions (GPT, Gemini и прочие) ───────────
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
