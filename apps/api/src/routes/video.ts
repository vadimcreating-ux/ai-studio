import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";
import { saveVideoToFiles, deleteFileById } from "../lib/files-store.js";
import { atomicDeduct, refundCredits, lookupPrice, spendCredits, getBalance } from "../lib/credits.js";

function sanitizeKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9\-]/g, "_");
}

const KLING_MODELS = new Set(["kling-3.0/motion-control"]);
const KIE_BASE_URL = "https://api.kie.ai";

// Pre-charged amount stored with task. Credits deducted BEFORE KIE call, refunded on failure.
type VideoTaskMeta = { prompt?: string; model: string; chargedAmount: number; operationKey: string };
const videoTaskStore = new Map<string, VideoTaskMeta>();

export async function videoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Генерация видео — 5 запросов в минуту per user
  app.post("/api/video/generate", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute",
        keyGenerator: (req: any) => req.authUser?.userId || req.ip,
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      model?: string;
      prompt?: string;
      // Sora params
      image_urls?: string[];
      aspect_ratio?: string;
      n_frames?: string;
      size?: string;
      remove_watermark?: boolean;
      // Kling params
      input_urls?: string[];
      video_urls?: string[];
      character_orientation?: string;
      mode?: string;
    };

    const prompt = body?.prompt?.trim();
    const apiKey = process.env.KIE_API_KEY;
    const userId = request.authUser?.userId;
    const model = body?.model?.trim() || "sora-2-pro-image-to-video";
    const isKling = KLING_MODELS.has(model);

    if (!apiKey) {
      return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    }
    // Kling: prompt is optional; Sora: required
    if (!isKling && !prompt) {
      return reply.status(400).send({ ok: false, error: "Введите prompt" });
    }

    // ── Pre-deduct credits before calling KIE ────────────────────────────────
    const mk = sanitizeKey(model);
    const priceKeys = [`video_${mk}`, "video_generate"];
    const price = await lookupPrice(priceKeys);

    let chargedAmount = 0;
    let operationKey = `video_${mk}`;

    if (price && userId) {
      chargedAmount = price.chargeAmount;
      operationKey = price.operationKey;
      const deducted = await atomicDeduct(
        userId,
        chargedAmount,
        operationKey,
        `Генерация видео (${model})`,
        { kieAmount: 0, markupPercent: price.markupPercent }
      );
      if (deducted === 0) {
        return reply.status(402).send({ ok: false, error: "Недостаточно кредитов. Пополните баланс." });
      }
    } else if (!price && userId) {
      return reply.status(402).send({ ok: false, error: "Для этой модели не установлена цена. Обратитесь к администратору." });
    }

    const input: Record<string, unknown> = {};
    if (prompt) input.prompt = prompt;

    if (isKling) {
      if (body?.input_urls?.length) input.input_urls = body.input_urls;
      if (body?.video_urls?.length) input.video_urls = body.video_urls;
      if (body?.character_orientation) input.character_orientation = body.character_orientation;
      if (body?.mode) input.mode = body.mode;
    } else {
      if (body?.image_urls?.length) input.image_urls = body.image_urls;
      if (body?.aspect_ratio) input.aspect_ratio = body.aspect_ratio;
      if (body?.n_frames) input.n_frames = body.n_frames;
      if (body?.size) input.size = body.size;
      if (body?.remove_watermark !== undefined) input.remove_watermark = body.remove_watermark;
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
        console.error("KIE video create error:", createResponse.status, JSON.stringify(createData));
        if (userId && chargedAmount > 0) {
          await refundCredits(userId, chargedAmount, operationKey, `Возврат: KIE отклонил задачу (${model})`);
        }
        return reply.status(500).send({
          ok: false,
          error: createData?.message || "KIE не вернул taskId",
        });
      }

      const taskId = createData.data.taskId!;
      if (taskId) videoTaskStore.set(taskId, { prompt: prompt || undefined, model, chargedAmount, operationKey });

      return { ok: true, taskId };
    } catch {
      if (userId && chargedAmount > 0) {
        await refundCredits(userId, chargedAmount, operationKey, `Возврат: ошибка при создании задачи (${model})`).catch(() => {});
      }
      return reply.status(500).send({ ok: false, error: "Не удалось создать задачу в KIE" });
    }
  });

  // Проверка статуса задачи
  app.get("/api/video/status", async (request, reply) => {
    const query = request.query as { taskId?: string };
    const taskId = query?.taskId?.trim();
    const apiKey = process.env.KIE_API_KEY;

    if (!apiKey) {
      return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    }
    if (!taskId) {
      return reply.status(400).send({ ok: false, error: "Не передан taskId" });
    }

    try {
      const statusResponse = await fetch(
        `${KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      const statusData = await statusResponse.json() as {
        code?: number;
        message?: string;
        data?: Record<string, unknown>;
      };

      const kieData = statusData.data;
      if (!statusResponse.ok || statusData.code !== 200 || !kieData) {
        return reply.status(500).send({
          ok: false,
          error: statusData.message || "Не удалось получить статус задачи",
        });
      }

      const state = (kieData.state as string | undefined) ?? "waiting";

      let videoUrl = "";
      if (kieData.resultJson) {
        try {
          const parsed = JSON.parse(kieData.resultJson as string) as {
            resultUrls?: string[];
            videoUrl?: string;
          };
          videoUrl = parsed.resultUrls?.[0] ?? parsed.videoUrl ?? "";
        } catch {
          // ignore
        }
      }

      const statusMap: Record<string, string> = {
        waiting: "GENERATING",
        queuing: "GENERATING",
        generating: "GENERATING",
        success: "SUCCESS",
        fail: "FAILED",
      };
      const mappedStatus = statusMap[state] ?? "GENERATING";

      if (state === "success" && videoUrl) {
        const resolvedTaskId = (kieData.taskId as string | undefined) ?? taskId;
        const userId = request.authUser?.userId;
        const meta = videoTaskStore.get(taskId) ?? { model: "sora-2-pro-image-to-video", chargedAmount: 0, operationKey: "video_generate" };

        try {
          const { isNew } = await saveVideoToFiles({
            taskId: resolvedTaskId,
            url: videoUrl,
            prompt: meta.prompt,
            userId,
          });
          if (isNew && meta.chargedAmount > 0) {
            // Credits pre-charged at /generate time — record on the file
            await dbQuery("UPDATE files SET credits_spent = $1 WHERE task_id = $2", [meta.chargedAmount, resolvedTaskId]);
            app.log.info({ taskId, model: meta.model, charged: meta.chargedAmount }, "video credited");
          }
        } catch (err: any) {
          if (err.message?.includes("хранилище")) {
            const userId2 = request.authUser?.userId;
            if (userId2 && meta.chargedAmount > 0) {
              await refundCredits(userId2, meta.chargedAmount, meta.operationKey, `Возврат: превышена квота хранилища`).catch(() => {});
            }
            return reply.status(507).send({ ok: false, error: err.message });
          }
          console.error("saveVideoToFiles failed:", err.message);
        }
        videoTaskStore.delete(taskId);

      } else if (mappedStatus === "FAILED") {
        const userId = request.authUser?.userId;
        const meta = videoTaskStore.get(taskId);
        if (userId && meta?.chargedAmount && meta.chargedAmount > 0) {
          await refundCredits(userId, meta.chargedAmount, meta.operationKey, `Возврат: задача завершилась с ошибкой (${meta.model})`).catch(() => {});
          app.log.info({ taskId, refunded: meta.chargedAmount }, "video generation failed — credits refunded");
        }
        videoTaskStore.delete(taskId);
      }

      return {
        ok: true,
        taskId: (kieData.taskId as string | undefined) ?? taskId,
        state,
        status: mappedStatus,
        videoUrl,
        progress: (kieData.progress as number | undefined) ?? 0,
        errorMessage: (kieData.failMsg as string | undefined) || "",
      };
    } catch {
      return reply.status(500).send({ ok: false, error: "Не удалось проверить статус в KIE" });
    }
  });

  // Скачивание видео через прокси
  app.get("/api/video/download", async (request, reply) => {
    const query = request.query as { url?: string; name?: string };
    const fileUrl = query?.url?.trim();
    const fileName = (query?.name?.trim() || "generated-video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");

    if (!fileUrl) {
      return reply.status(400).send({ ok: false, error: "Не передан url файла" });
    }

    try {
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        return reply.status(500).send({ ok: false, error: "Не удалось скачать файл" });
      }
      const contentType = fileResponse.headers.get("content-type") || "video/mp4";
      const buffer = Buffer.from(await fileResponse.arrayBuffer());
      reply
        .header("Content-Type", contentType)
        .header("Content-Disposition", `attachment; filename="${fileName}"`)
        .send(buffer);
    } catch {
      return reply.status(500).send({ ok: false, error: "Ошибка при скачивании файла" });
    }
  });

  // История видео
  app.get("/api/video/history", async (request) => {
    const userId = request.authUser?.userId;
    const whereParts = ["type = 'video'"];
    const params: unknown[] = [];
    if (userId) {
      whereParts.push(`user_id = $${params.length + 1}`);
      params.push(userId);
    }
    const result = await dbQuery(
      `SELECT id, task_id, type, name, url, storage_url, created_at, source, prompt, file_size_bytes
       FROM files WHERE ${whereParts.join(" AND ")} ORDER BY created_at DESC`,
      params
    );
    return {
      ok: true,
      files: result.rows.map((row: any) => ({
        id: row.id,
        taskId: row.task_id,
        type: row.type,
        name: row.name,
        url: row.storage_url ?? row.url,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        source: row.source,
        prompt: row.prompt ?? null,
        fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : null,
      })),
    };
  });

  // Удаление видео из истории
  app.delete("/api/video/history/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const deleted = await deleteFileById(params.id, request.authUser?.userId);
    if (!deleted) {
      return reply.status(404).send({ ok: false, error: "Файл не найден" });
    }
    return { ok: true };
  });

  // Улучшение промпта для видео
  app.post("/api/video/improve-prompt", async (request, reply) => {
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

    const systemMessage = `Ты — эксперт по prompt engineering для генерации видео с помощью ИИ (Sora, Kling, Runway).
Твоя задача: взять исходный запрос пользователя и создать профессиональный видео-промпт, который даст кинематографический результат.

Структура профессионального видео-промпта:
1. СЦЕНА — главный субъект, место действия, начальное состояние
2. ОПИСАТЕЛЬНЫЕ ДЕТАЛИ — цвета, текстуры, материалы, детали окружения, внешний вид объектов
3. ДВИЖЕНИЕ СУБЪЕКТА — что и как движется внутри кадра, динамика действия
4. ДВИЖЕНИЕ КАМЕРЫ — тип съёмки (дрон-шот, слежение, статика, зум, панорама)
5. ОСВЕЩЕНИЕ И АТМОСФЕРА — световые условия, настроение, цветовая гамма
6. СТИЛЬ — кинематографический стиль, жанр, референс (документальный, художественный, реклама)
7. ТЕМП И ДЛИТЕЛЬНОСТЬ — медленное/быстрое движение, ритм монтажа
8. КАЧЕСТВО — технические модификаторы (4K, кинескоп, HDR, cinematic LUT)

Правила:
- Пиши промпт ТОЛЬКО на русском языке
- Используй конкретные профессиональные кинотермины
- Описывай динамику: как сцена меняется от начала к концу
- Добавляй детали которых нет в исходнике, но которые усилят кинематографичность
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

  // Перевод промпта для видео
  app.post("/api/video/translate-prompt", async (request, reply) => {
    const body = request.body as { prompt?: string };
    const prompt = body?.prompt?.trim();
    const apiKey = process.env.KIE_API_KEY;

    if (!apiKey) return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    if (!prompt) return reply.status(400).send({ ok: false, error: "Введите prompt" });

    const systemMessage = `You are a professional translator specializing in AI video generation prompts.
Translate the given text to English accurately and naturally.
Rules:
- Translate to English only
- Preserve all cinematic and motion-related terms
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
        return reply.status(500).send({ ok: false, error: kieData.error?.message || "Не удалось перевести промпт" });
      }

      return { ok: true, translatedPrompt: translated };
    } catch {
      return reply.status(500).send({ ok: false, error: "Ошибка при обращении к KIE" });
    }
  });

  // ─── Шаблоны промптов ────────────────────────────────────────────────────

  app.get("/api/video-templates", async () => {
    const result = await dbQuery(
      `SELECT id, title, text, created_at FROM video_prompt_templates ORDER BY created_at DESC`
    );
    return { ok: true, templates: result.rows };
  });

  app.post("/api/video-templates", async (request, reply) => {
    const body = request.body as { title?: string; text?: string };
    const title = body?.title?.trim();
    const text = body?.text?.trim();
    if (!title || !text) {
      return reply.status(400).send({ ok: false, error: "title и text обязательны" });
    }
    const result = await dbQuery(
      `INSERT INTO video_prompt_templates (title, text) VALUES ($1, $2) RETURNING *`,
      [title, text]
    );
    return { ok: true, template: result.rows[0] };
  });

  app.delete("/api/video-templates/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const result = await dbQuery(
      `DELETE FROM video_prompt_templates WHERE id = $1`,
      [params.id]
    );
    if ((result.rowCount ?? 0) === 0) {
      return reply.status(404).send({ ok: false, error: "Шаблон не найден" });
    }
    return { ok: true };
  });
}
