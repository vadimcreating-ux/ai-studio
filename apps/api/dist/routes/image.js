import { saveImageToFiles, getFiles, deleteFileById, } from "../lib/files-store.js";
import { dbQuery } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";
import { FilesQuerySchema } from "../lib/validation.js";
const KIE_BASE_URL = "https://api.kie.ai";
const imagePromptStore = new Map();
const imageCostStore = new Map();
// Returns cost deducted (>= 0) on success, or false on failure (reply already sent)
async function deductCredits(userId, operation, reply) {
    const priceRes = await dbQuery("SELECT credits, markup_percent FROM credit_prices WHERE operation = $1", [operation]);
    const baseCredits = Number(priceRes.rows[0]?.credits ?? 0);
    if (baseCredits === 0)
        return 0;
    const markupPercent = Number(priceRes.rows[0]?.markup_percent ?? 0);
    const cost = Math.round(baseCredits * (1 + markupPercent / 100) * 10000) / 10000;
    const result = await dbQuery("UPDATE users SET credits_balance = credits_balance - $1 WHERE id = $2 AND credits_balance >= $1 RETURNING credits_balance", [cost, userId]);
    if (result.rows.length === 0) {
        reply.status(402).send({ ok: false, error: "Недостаточно кредитов. Пополните баланс в настройках аккаунта." });
        return false;
    }
    await dbQuery("INSERT INTO credit_transactions (user_id, amount, type, operation, description) VALUES ($1, $2, 'spend', $3, $4)", [userId, -cost, operation, `Запрос к ${operation}`]);
    return cost;
}
export async function imageRoutes(app) {
    app.addHook("preHandler", authenticate);
    // Генерация изображения — 10 запросов в минуту (дорогая операция)
    app.post("/api/image/generate", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
        const user = request.authUser;
        const creditsResult = await deductCredits(user.userId, "image_generate", reply);
        if (creditsResult === false)
            return;
        const creditsSpent = creditsResult;
        const body = request.body;
        const apiKey = process.env.KIE_API_KEY;
        if (!apiKey) {
            return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
        }
        const model = body?.model?.trim() || "nano-banana-pro";
        const isTopaz = model === "topaz/image-upscale";
        const isRecraft = model === "recraft/remove-background";
        const isIdeogram = model === "ideogram/v3-reframe";
        const isSeedream = model === "seedream/4.5-edit";
        const isUrlOnly = isTopaz || isRecraft || isIdeogram;
        const prompt = body?.prompt?.trim();
        if (!isUrlOnly && !prompt) {
            return reply.status(400).send({ ok: false, error: "Введите prompt" });
        }
        if (isUrlOnly && !body?.image_url?.trim()) {
            return reply.status(400).send({ ok: false, error: "Укажите image_url" });
        }
        let input;
        if (isTopaz) {
            input = {
                image_url: body.image_url,
                upscale_factor: body?.upscale_factor ?? "2",
            };
        }
        else if (isRecraft) {
            input = { image: body.image_url };
        }
        else if (isIdeogram) {
            input = {
                image_url: body.image_url,
                image_size: body?.ideogram_image_size ?? "square_hd",
                rendering_speed: body?.ideogram_rendering_speed ?? "BALANCED",
                style: body?.ideogram_style ?? "AUTO",
                num_images: body?.ideogram_num_images ?? "1",
            };
        }
        else {
            input = { prompt };
            if (body?.aspect_ratio)
                input.aspect_ratio = body.aspect_ratio;
            if (isSeedream) {
                if (body?.image_urls?.length)
                    input.image_urls = body.image_urls;
                if (body?.quality)
                    input.quality = body.quality;
            }
            else {
                if (body?.image_input?.length)
                    input.image_input = body.image_input;
                if (body?.resolution)
                    input.resolution = body.resolution;
                if (body?.output_format)
                    input.output_format = body.output_format;
            }
        }
        try {
            const createResponse = await fetch(`${KIE_BASE_URL}/api/v1/jobs/createTask`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ model, input }),
            });
            const createData = await createResponse.json();
            if (!createResponse.ok || createData?.code !== 200 || !createData?.data?.taskId) {
                console.error("KIE image create error:", createResponse.status, JSON.stringify(createData));
                return reply.status(500).send({
                    ok: false,
                    error: createData?.message || "KIE не вернул taskId",
                    debug: { status: createResponse.status, body: createData },
                });
            }
            const taskId = createData.data.taskId;
            if (prompt)
                imagePromptStore.set(taskId, prompt);
            if (creditsSpent > 0)
                imageCostStore.set(taskId, creditsSpent);
            return { ok: true, taskId };
        }
        catch {
            return reply.status(500).send({ ok: false, error: "Не удалось создать задачу в KIE" });
        }
    });
    // Проверка статуса задачи
    app.get("/api/image/status", async (request, reply) => {
        const query = request.query;
        const taskId = query?.taskId?.trim();
        const apiKey = process.env.KIE_API_KEY;
        if (!apiKey) {
            return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
        }
        if (!taskId) {
            return reply.status(400).send({ ok: false, error: "Не передан taskId" });
        }
        try {
            const statusResponse = await fetch(`${KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            const statusData = await statusResponse.json();
            if (!statusResponse.ok || statusData?.code !== 200 || !statusData?.data) {
                console.error("KIE image status error:", statusResponse.status, JSON.stringify(statusData));
                return reply.status(500).send({
                    ok: false,
                    error: statusData?.message || "Не удалось получить статус задачи",
                });
            }
            const data = statusData.data;
            const state = data.state ?? "waiting";
            // Parse resultJson string to get image URLs
            let resultImageUrl = "";
            if (data.resultJson) {
                try {
                    const parsed = JSON.parse(data.resultJson);
                    resultImageUrl = parsed.resultUrls?.[0] ?? "";
                }
                catch {
                    // ignore parse error
                }
            }
            if (state === "success" && resultImageUrl) {
                const resolvedTaskId = data.taskId ?? taskId;
                try {
                    await saveImageToFiles({
                        taskId: resolvedTaskId,
                        url: resultImageUrl,
                        prompt: imagePromptStore.get(taskId) || undefined,
                        userId: request.authUser?.userId,
                        creditsSpent: imageCostStore.get(taskId),
                    });
                }
                catch (err) {
                    if (err.message?.includes("хранилище")) {
                        return reply.status(507).send({ ok: false, error: err.message });
                    }
                    console.error("saveImageToFiles failed:", err.message);
                }
                imagePromptStore.delete(taskId);
                imageCostStore.delete(taskId);
            }
            const statusMap = {
                waiting: "GENERATING",
                queuing: "GENERATING",
                generating: "GENERATING",
                success: "SUCCESS",
                fail: "FAILED",
            };
            return {
                ok: true,
                taskId: data.taskId ?? taskId,
                state,
                status: statusMap[state] ?? "GENERATING",
                imageUrl: resultImageUrl,
                errorMessage: data.failMsg || "",
            };
        }
        catch {
            return reply.status(500).send({ ok: false, error: "Не удалось проверить статус в KIE" });
        }
    });
    // Скачивание изображения через прокси (обход CORS)
    app.get("/api/image/download", async (request, reply) => {
        const query = request.query;
        const fileUrl = query?.url?.trim();
        const fileName = (query?.name?.trim() || "generated-image.png").replace(/[^a-zA-Z0-9._-]/g, "_");
        if (!fileUrl) {
            return reply.status(400).send({ ok: false, error: "Не передан url файла" });
        }
        try {
            const fileResponse = await fetch(fileUrl);
            if (!fileResponse.ok) {
                return reply.status(500).send({ ok: false, error: "Не удалось скачать файл" });
            }
            const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";
            const buffer = Buffer.from(await fileResponse.arrayBuffer());
            reply
                .header("Content-Type", contentType)
                .header("Content-Disposition", `attachment; filename="${fileName}"`)
                .send(buffer);
        }
        catch {
            return reply.status(500).send({ ok: false, error: "Ошибка при скачивании файла" });
        }
    });
    // Список файлов (с пагинацией)
    app.get("/api/files", async (request, reply) => {
        const parsed = FilesQuerySchema.safeParse(request.query);
        if (!parsed.success)
            return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные параметры" });
        const { limit, offset } = parsed.data;
        const userId = request.authUser?.userId;
        const { files, total } = await getFiles(limit, offset, userId);
        return { ok: true, files, total, limit, offset };
    });
    // Улучшение промпта через GPT
    app.post("/api/image/improve-prompt", async (request, reply) => {
        const body = request.body;
        const prompt = body?.prompt?.trim();
        const apiKey = process.env.KIE_API_KEY;
        if (!apiKey) {
            return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
        }
        if (!prompt) {
            return reply.status(400).send({ ok: false, error: "Введите prompt" });
        }
        const systemMessage = `Ты — эксперт по составлению промптов для генерации изображений с помощью ИИ.
Твоя задача: взять описание пользователя и превратить его в детальный, профессиональный промпт.
Правила:
- Пиши улучшенный промпт ТОЛЬКО на русском языке
- Добавляй конкретные детали: освещение, стиль, ракурс камеры, настроение, цвета, текстуры, художественный стиль
- Добавляй технические параметры: "фотореализм", "кинематографическое освещение", "высокая детализация" и т.п.
- Объём: 2–4 предложения, ёмко и описательно
- Верни ТОЛЬКО текст улучшенного промпта — без пояснений, без заголовков`;
        try {
            const kieResponse = await fetch(`${KIE_BASE_URL}/gpt-5-2/v1/chat/completions`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: [{ type: "text", text: systemMessage }] },
                        { role: "user", content: [{ type: "text", text: prompt }] },
                    ],
                    stream: false,
                }),
            });
            const kieData = await kieResponse.json();
            const improved = kieData.choices?.[0]?.message?.content?.trim();
            if (!improved) {
                console.error("KIE improve-prompt error:", JSON.stringify(kieData));
                return reply.status(500).send({ ok: false, error: kieData.error?.message || "Не удалось улучшить промпт" });
            }
            return { ok: true, improvedPrompt: improved };
        }
        catch {
            return reply.status(500).send({ ok: false, error: "Ошибка при обращении к KIE" });
        }
    });
    // Перевод промпта на английский через GPT
    app.post("/api/image/translate-prompt", async (request, reply) => {
        const body = request.body;
        const prompt = body?.prompt?.trim();
        const apiKey = process.env.KIE_API_KEY;
        if (!apiKey) {
            return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
        }
        if (!prompt) {
            return reply.status(400).send({ ok: false, error: "Введите prompt" });
        }
        const systemMessage = `You are a professional translator specializing in AI image generation prompts.
Translate the given text to English accurately and naturally.
Rules:
- Translate to English only
- Preserve all technical image generation terms, artistic styles, and descriptive details
- Return ONLY the translated text — no explanations, no labels`;
        try {
            const kieResponse = await fetch(`${KIE_BASE_URL}/gpt-5-2/v1/chat/completions`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: [{ type: "text", text: systemMessage }] },
                        { role: "user", content: [{ type: "text", text: prompt }] },
                    ],
                    stream: false,
                }),
            });
            const kieData = await kieResponse.json();
            const translated = kieData.choices?.[0]?.message?.content?.trim();
            if (!translated) {
                console.error("KIE translate-prompt error:", JSON.stringify(kieData));
                return reply.status(500).send({ ok: false, error: kieData.error?.message || "Не удалось перевести промпт" });
            }
            return { ok: true, translatedPrompt: translated };
        }
        catch {
            return reply.status(500).send({ ok: false, error: "Ошибка при обращении к KIE" });
        }
    });
    // Удаление файла
    app.delete("/api/files/:id", async (request, reply) => {
        const params = request.params;
        const id = params?.id?.trim();
        if (!id) {
            return reply.status(400).send({ ok: false, error: "Не передан id файла" });
        }
        const deleted = await deleteFileById(id, request.authUser?.userId);
        if (!deleted) {
            return reply.status(404).send({ ok: false, error: "Файл не найден" });
        }
        return { ok: true, id };
    });
    // Шаблоны промптов для изображений
    app.get("/api/image-templates", async () => {
        const result = await dbQuery(`SELECT id, title, text, created_at FROM image_prompt_templates ORDER BY created_at DESC`);
        return { ok: true, templates: result.rows };
    });
    app.post("/api/image-templates", async (request, reply) => {
        const body = request.body;
        const title = body?.title?.trim();
        const text = body?.text?.trim();
        if (!title || !text) {
            return reply.status(400).send({ ok: false, error: "title и text обязательны" });
        }
        const result = await dbQuery(`INSERT INTO image_prompt_templates (title, text) VALUES ($1, $2) RETURNING *`, [title, text]);
        return { ok: true, template: result.rows[0] };
    });
    app.delete("/api/image-templates/:id", async (request, reply) => {
        const params = request.params;
        const result = await dbQuery(`DELETE FROM image_prompt_templates WHERE id = $1`, [params.id]);
        if ((result.rowCount ?? 0) === 0) {
            return reply.status(404).send({ ok: false, error: "Шаблон не найден" });
        }
        return { ok: true };
    });
}
