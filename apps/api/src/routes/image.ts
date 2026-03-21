import type { FastifyInstance } from "fastify";
import {
  saveImageToFiles,
  getFiles,
  deleteFileById,
} from "../lib/files-store.js";
import { dbQuery } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";
import { FilesQuerySchema } from "../lib/validation.js";
import { uploadToS3, isS3Configured } from "../lib/s3.js";
import { atomicDeduct, refundCredits, lookupPrice, spendCredits, getBalance } from "../lib/credits.js";

const KIE_BASE_URL = "https://api.kie.ai";

// Sanitize model name for use as DB operation key
function sanitizeKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9\-]/g, "_");
}

// Pre-charged amount is stored alongside task metadata.
// Credits are deducted BEFORE calling KIE, refunded on failure.
type TaskMeta = { prompt?: string; model: string; resolution: string; chargedAmount: number; operationKey: string };
const imageTaskStore = new Map<string, TaskMeta>();

export async function imageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Генерация изображения — 10 запросов в минуту per user
  app.post("/api/image/generate", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: (req: any) => req.authUser?.userId || req.ip,
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      model?: string;
      prompt?: string;
      image_input?: string[];  // base64 data URLs (Nano Banana / Grok)
      image_urls?: string[];   // URLs (Seedream)
      image_url?: string;      // single URL (Topaz / Recraft / Ideogram)
      aspect_ratio?: string;
      resolution?: string;
      output_format?: string;
      quality?: string;        // Seedream: basic | high
      upscale_factor?: string; // Topaz: 1 | 2 | 4 | 8
      ideogram_image_size?: string;
      ideogram_rendering_speed?: string;
      ideogram_style?: string;
      ideogram_num_images?: string;
    };

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });

    const userId = request.authUser?.userId;
    const model = body?.model?.trim() || "nano-banana-pro";
    const isTopaz = model === "topaz/image-upscale";
    // For Topaz: use upscale_factor as resolution key (for per-factor pricing)
    const resolution = isTopaz
      ? (body?.upscale_factor?.trim() || "2")
      : (body?.resolution?.trim() || "1K");
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

    // ── Pre-deduct credits before calling KIE ────────────────────────────────
    const mk = sanitizeKey(model);
    const rk = sanitizeKey(resolution);
    const priceKeys = [`image_${mk}_${rk}`, `image_${mk}`, "image_generate"];
    const price = await lookupPrice(priceKeys);

    let chargedAmount = 0;
    let operationKey = `image_${mk}`;

    if (price && userId) {
      chargedAmount = price.chargeAmount;
      operationKey = price.operationKey;
      const deducted = await atomicDeduct(
        userId,
        chargedAmount,
        operationKey,
        `Генерация изображения (${model})`,
        { kieAmount: 0, markupPercent: price.markupPercent }
      );
      if (deducted === 0) {
        return reply.status(402).send({ ok: false, error: "Недостаточно кредитов. Пополните баланс." });
      }
    } else if (!price && userId) {
      // Model not priced — reject to prevent free generation
      return reply.status(402).send({ ok: false, error: "Для этой модели не установлена цена. Обратитесь к администратору." });
    }

    let input: Record<string, unknown>;

    if (isTopaz) {
      input = {
        image_url: body.image_url,
        upscale_factor: body?.upscale_factor ?? "2",
      };
    } else if (isRecraft) {
      input = { image: body.image_url };
    } else if (isIdeogram) {
      input = {
        image_url: body.image_url,
        image_size: body?.ideogram_image_size ?? "square_hd",
        rendering_speed: body?.ideogram_rendering_speed ?? "BALANCED",
        style: body?.ideogram_style ?? "AUTO",
        num_images: body?.ideogram_num_images ?? "1",
      };
    } else {
      input = { prompt };
      if (body?.aspect_ratio) input.aspect_ratio = body.aspect_ratio;
      if (isSeedream) {
        if (body?.image_urls?.length) input.image_urls = body.image_urls;
        if (body?.quality) input.quality = body.quality;
      } else {
        if (body?.image_input?.length) {
          if (!isS3Configured()) {
            return reply.status(400).send({ ok: false, error: "Загрузка референс-изображений требует настройки S3-хранилища" });
          }
          const uploadedUrls = await Promise.all(
            body.image_input.map(async (dataUrl: string, idx: number) => {
              const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (!match) throw new Error(`image_input[${idx}]: не data URL`);
              const [, mimeType, b64] = match;
              const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
              const key = `ref-images/${Date.now()}-${idx}.${ext}`;
              const buffer = Buffer.from(b64, "base64");
              return uploadToS3(buffer, key, mimeType);
            })
          );
          input.image_input = uploadedUrls;
        }
        if (resolution) input.resolution = resolution;
        if (body?.output_format) input.output_format = body.output_format;
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

      const createData = await createResponse.json() as {
        code?: number;
        message?: string;
        data?: { taskId?: string };
      };

      if (!createResponse.ok || createData?.code !== 200 || !createData?.data?.taskId) {
        console.error("KIE image create error:", createResponse.status, JSON.stringify(createData));
        // Refund pre-charged credits — KIE rejected the task
        if (userId && chargedAmount > 0) {
          await refundCredits(userId, chargedAmount, operationKey, `Возврат: KIE отклонил задачу (${model})`);
        }
        return reply.status(500).send({
          ok: false,
          error: createData?.message || "KIE не вернул taskId",
          debug: { status: createResponse.status, body: createData },
        });
      }

      const taskId = createData.data.taskId;
      imageTaskStore.set(taskId, { prompt: prompt || undefined, model, resolution, chargedAmount, operationKey });

      return { ok: true, taskId };
    } catch (err) {
      // Refund on unexpected error
      if (userId && chargedAmount > 0) {
        await refundCredits(userId, chargedAmount, operationKey, `Возврат: ошибка при создании задачи (${model})`).catch(() => {});
      }
      return reply.status(500).send({ ok: false, error: "Не удалось создать задачу в KIE" });
    }
  });

  // Проверка статуса задачи
  app.get("/api/image/status", async (request, reply) => {
    const query = request.query as { taskId?: string };
    const taskId = query?.taskId?.trim();
    const apiKey = process.env.KIE_API_KEY;

    if (!apiKey) return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    if (!taskId) return reply.status(400).send({ ok: false, error: "Не передан taskId" });

    try {
      const statusResponse = await fetch(
        `${KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      const statusData = await statusResponse.json() as {
        code?: number;
        message?: string;
        data?: {
          taskId?: string;
          state?: string;
          resultJson?: string;
          failCode?: string;
          failMsg?: string;
          costTime?: number;
        };
      };

      const kieData = statusData.data;
      if (!statusResponse.ok || statusData.code !== 200 || !kieData) {
        console.error("KIE image status error:", statusResponse.status, JSON.stringify(statusData));
        return reply.status(500).send({
          ok: false,
          error: statusData.message || "Не удалось получить статус задачи",
        });
      }

      const state = kieData.state ?? "waiting";

      let resultImageUrl = "";
      if (kieData.resultJson) {
        try {
          const parsed = JSON.parse(kieData.resultJson) as { resultUrls?: string[] };
          resultImageUrl = parsed.resultUrls?.[0] ?? "";
        } catch { /* ignore */ }
      }

      const generatingStates = new Set(["waiting", "queuing", "generating"]);
      const mappedStatus = state === "success"
        ? "SUCCESS"
        : generatingStates.has(state)
        ? "GENERATING"
        : "FAILED";

      if (state === "success" && resultImageUrl) {
        const resolvedTaskId = kieData.taskId ?? taskId;
        const userId = request.authUser?.userId;
        const meta = imageTaskStore.get(taskId) ?? { model: "unknown", resolution: "1K", chargedAmount: 0, operationKey: "image_generate" };

        try {
          const { isNew } = await saveImageToFiles({
            taskId: resolvedTaskId,
            url: resultImageUrl,
            prompt: meta.prompt,
            userId,
          });
          if (isNew && meta.chargedAmount > 0) {
            // Credits were pre-charged at /generate time — just record the amount on the file
            await dbQuery("UPDATE files SET credits_spent = $1 WHERE task_id = $2", [meta.chargedAmount, resolvedTaskId]);
            app.log.info({ taskId, model: meta.model, resolution: meta.resolution, charged: meta.chargedAmount }, "image credited");
          }
        } catch (err: any) {
          if (err.message?.includes("хранилище")) {
            // Storage quota exceeded — refund the pre-charged credits
            if (userId && meta.chargedAmount > 0) {
              await refundCredits(userId, meta.chargedAmount, meta.operationKey, `Возврат: превышена квота хранилища`).catch(() => {});
            }
            return reply.status(507).send({ ok: false, error: err.message });
          }
          console.error("saveImageToFiles failed:", err.message);
        }
        imageTaskStore.delete(taskId);

      } else if (mappedStatus === "FAILED") {
        // Task failed — refund pre-charged credits
        const userId = request.authUser?.userId;
        const meta = imageTaskStore.get(taskId);
        if (userId && meta?.chargedAmount && meta.chargedAmount > 0) {
          await refundCredits(userId, meta.chargedAmount, meta.operationKey, `Возврат: задача завершилась с ошибкой (${meta.model})`).catch(() => {});
          app.log.info({ taskId, refunded: meta.chargedAmount }, "image generation failed — credits refunded");
        }
        imageTaskStore.delete(taskId);
      }

      return {
        ok: true,
        taskId: kieData.taskId ?? taskId,
        state,
        status: mappedStatus,
        imageUrl: resultImageUrl,
        errorMessage: kieData.failMsg || (mappedStatus === "FAILED" ? `Задача завершилась со статусом: ${state}` : ""),
      };
    } catch {
      return reply.status(500).send({ ok: false, error: "Не удалось проверить статус в KIE" });
    }
  });

  // Скачивание изображения через прокси (обход CORS)
  app.get("/api/image/download", async (request, reply) => {
    const query = request.query as { url?: string; name?: string };
    const fileUrl = query?.url?.trim();
    const fileName = (query?.name?.trim() || "generated-image.png").replace(/[^a-zA-Z0-9._-]/g, "_");

    if (!fileUrl) return reply.status(400).send({ ok: false, error: "Не передан url файла" });

    try {
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) return reply.status(500).send({ ok: false, error: "Не удалось скачать файл" });
      const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";
      const buffer = Buffer.from(await fileResponse.arrayBuffer());
      reply
        .header("Content-Type", contentType)
        .header("Content-Disposition", `attachment; filename="${fileName}"`)
        .send(buffer);
    } catch {
      return reply.status(500).send({ ok: false, error: "Ошибка при скачивании файла" });
    }
  });

  // Список файлов (с пагинацией)
  app.get("/api/files", async (request, reply) => {
    const parsed = FilesQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные параметры" });
    const { limit, offset } = parsed.data;
    const userId = request.authUser?.userId;
    const { files, total } = await getFiles(limit, offset, userId);
    return { ok: true, files, total, limit, offset };
  });

  // Улучшение промпта через GPT
  app.post("/api/image/improve-prompt", async (request, reply) => {
    const body = request.body as { prompt?: string };
    const prompt = body?.prompt?.trim();
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    if (!prompt) return reply.status(400).send({ ok: false, error: "Введите prompt" });

    const userId = request.authUser?.userId;
    if (userId) {
      const balance = await getBalance(userId);
      if (balance <= 0) return reply.status(402).send({ ok: false, error: "Недостаточно кредитов. Пополните баланс." });
    }

    const systemMessage = `Ты — эксперт по prompt engineering для генерации изображений с помощью ИИ (Midjourney, Stable Diffusion, DALL-E, Flux).
Твоя задача: взять исходный запрос пользователя и создать профессиональный промпт, который даст наилучший результат.

Структура профессионального промпта:
1. СУБЪЕКТ — чёткое описание главного объекта/сцены/персонажа
2. ДЕЙСТВИЕ/СОСТОЯНИЕ — что происходит, поза, эмоция
3. СРЕДА — место, время суток, обстановка
4. ОПИСАТЕЛЬНЫЕ ДЕТАЛИ — цвета, текстуры, материалы, фактуры, детали одежды/поверхностей/объектов
5. СТИЛЬ — художественный стиль, референсные художники или эпоха
6. ОСВЕЩЕНИЕ — тип и характер света (золотой час, студийный свет, неон и т.п.)
7. КАМЕРА — ракурс, план, объектив, глубина резкости
8. КАЧЕСТВО — технические модификаторы (фотореализм, 8K, award-winning photography и т.п.)

Правила:
- Пиши промпт ТОЛЬКО на русском языке
- Используй конкретные профессиональные термины из индустрии
- Добавляй детали которых нет в исходнике, но которые усилят результат
- Объём: 3–5 предложений, структурированно и ёмко
- Верни ТОЛЬКО текст готового промпта — без пояснений, без заголовков, без нумерации`;

    try {
      const kieResponse = await fetch(`${KIE_BASE_URL}/gpt-5-2/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: [{ type: "text", text: systemMessage }] },
            { role: "user", content: [{ type: "text", text: prompt }] },
          ],
          stream: false,
        }),
      });
      const kieData = await kieResponse.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        credits_consumed?: number;
        error?: { message?: string };
      };
      const improved = kieData.choices?.[0]?.message?.content?.trim();
      if (!improved) {
        console.error("KIE improve-prompt error:", JSON.stringify(kieData));
        return reply.status(500).send({ ok: false, error: kieData.error?.message || "Не удалось улучшить промпт" });
      }
      if (userId) {
        const kieCredits = typeof kieData.credits_consumed === "number" ? kieData.credits_consumed : 0;
        await spendCredits(userId, kieCredits, "prompt_improve").catch(() => {});
      }
      return { ok: true, improvedPrompt: improved };
    } catch {
      return reply.status(500).send({ ok: false, error: "Ошибка при обращении к KIE" });
    }
  });

  // Перевод промпта на английский через GPT
  app.post("/api/image/translate-prompt", async (request, reply) => {
    const body = request.body as { prompt?: string };
    const prompt = body?.prompt?.trim();
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    if (!prompt) return reply.status(400).send({ ok: false, error: "Введите prompt" });

    const systemMessage = `You are a professional translator specializing in AI image generation prompts.
Translate the given text to English accurately and naturally.
Rules:
- Translate to English only
- Preserve all technical image generation terms, artistic styles, and descriptive details
- Return ONLY the translated text — no explanations, no labels`;

    try {
      const kieResponse = await fetch(`${KIE_BASE_URL}/gpt-5-2/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: [{ type: "text", text: systemMessage }] },
            { role: "user", content: [{ type: "text", text: prompt }] },
          ],
          stream: false,
        }),
      });
      const kieData = await kieResponse.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };
      const translated = kieData.choices?.[0]?.message?.content?.trim();
      if (!translated) {
        console.error("KIE translate-prompt error:", JSON.stringify(kieData));
        return reply.status(500).send({ ok: false, error: kieData.error?.message || "Не удалось перевести промпт" });
      }
      return { ok: true, translatedPrompt: translated };
    } catch {
      return reply.status(500).send({ ok: false, error: "Ошибка при обращении к KIE" });
    }
  });

  // Удаление файла
  app.delete("/api/files/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const id = params?.id?.trim();
    if (!id) return reply.status(400).send({ ok: false, error: "Не передан id файла" });
    const deleted = await deleteFileById(id, request.authUser?.userId);
    if (!deleted) return reply.status(404).send({ ok: false, error: "Файл не найден" });
    return { ok: true, id };
  });

  // Шаблоны промптов для изображений
  app.get("/api/image-templates", async () => {
    const result = await dbQuery(`SELECT id, title, text, created_at FROM image_prompt_templates ORDER BY created_at DESC`);
    return { ok: true, templates: result.rows };
  });

  app.post("/api/image-templates", async (request, reply) => {
    const body = request.body as { title?: string; text?: string };
    const title = body?.title?.trim();
    const text = body?.text?.trim();
    if (!title || !text) return reply.status(400).send({ ok: false, error: "title и text обязательны" });
    const result = await dbQuery(`INSERT INTO image_prompt_templates (title, text) VALUES ($1, $2) RETURNING *`, [title, text]);
    return { ok: true, template: result.rows[0] };
  });

  app.delete("/api/image-templates/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const result = await dbQuery(`DELETE FROM image_prompt_templates WHERE id = $1`, [params.id]);
    if ((result.rowCount ?? 0) === 0) return reply.status(404).send({ ok: false, error: "Шаблон не найден" });
    return { ok: true };
  });
}
