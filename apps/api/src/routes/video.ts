import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";
import { saveVideoToFiles, deleteFileById } from "../lib/files-store.js";

// Charge actual KIE credits × markup. Returns 0 if KIE didn't report credits.
async function chargeKieCredits(userId: string, kieCredits: number, operation: string): Promise<number> {
  if (kieCredits <= 0) return 0;
  let markupPercent = 0;
  try {
    const priceRes = await dbQuery("SELECT markup_percent FROM credit_prices WHERE operation = $1", [operation]);
    markupPercent = Number(priceRes.rows[0]?.markup_percent ?? 0);
  } catch { /* column might not exist yet */ }
  const amount = Math.round(kieCredits * (1 + markupPercent / 100) * 10000) / 10000;
  await dbQuery(
    "UPDATE users SET credits_balance = credits_balance - $1 WHERE id = $2",
    [amount, userId]
  );
  await dbQuery(
    "INSERT INTO credit_transactions (user_id, amount, type, operation, description) VALUES ($1, $2, 'spend', $3, $4)",
    [userId, -amount, operation, `Генерация ${operation}`]
  );
  return amount;
}

const KLING_MODELS = new Set(["kling-3.0/motion-control"]);

const KIE_BASE_URL = "https://api.kie.ai";
const videoPromptStore = new Map<string, string>();

export async function videoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Генерация видео — 5 запросов в минуту (очень дорогая операция)
  app.post("/api/video/generate", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
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
    const model = body?.model?.trim() || "sora-2-pro-image-to-video";
    const isKling = KLING_MODELS.has(model);

    if (!apiKey) {
      return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    }
    // Kling: prompt is optional; Sora: required
    if (!isKling && !prompt) {
      return reply.status(400).send({ ok: false, error: "Введите prompt" });
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
        return reply.status(500).send({
          ok: false,
          error: createData?.message || "KIE не вернул taskId",
        });
      }

      const taskId = createData.data.taskId!;
      if (taskId) videoPromptStore.set(taskId, prompt ?? "");

      return { ok: true, taskId };
    } catch {
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

      if (state === "success" && videoUrl) {
        const resolvedTaskId = (kieData.taskId as string | undefined) ?? taskId;
        const userId = request.authUser?.userId;

        // Log full KIE data to see what credit field is returned
        app.log.info({ taskId, kieData }, "KIE video success data");
        const kieCredits = typeof kieData.credits === "number" ? kieData.credits : 0;
        app.log.info({ taskId, kieCredits }, "KIE video credits consumed");

        try {
          const { isNew } = await saveVideoToFiles({
            taskId: resolvedTaskId,
            url: videoUrl,
            prompt: videoPromptStore.get(taskId),
            userId,
          });
          if (isNew && userId) {
            const spent = await chargeKieCredits(userId, kieCredits, "video_generate");
            if (spent > 0) {
              await dbQuery("UPDATE files SET credits_spent = $1 WHERE task_id = $2", [spent, resolvedTaskId]);
            }
          } else if (!isNew && kieCredits > 0) {
            await dbQuery(
              "UPDATE files SET credits_spent = $1 WHERE task_id = $2 AND credits_spent IS NULL",
              [kieCredits, resolvedTaskId]
            );
          }
        } catch (err: any) {
          if (err.message?.includes("хранилище")) {
            return reply.status(507).send({ ok: false, error: err.message });
          }
          console.error("saveVideoToFiles failed:", err.message);
        }
        videoPromptStore.delete(taskId);
      }

      const statusMap: Record<string, string> = {
        waiting: "GENERATING",
        queuing: "GENERATING",
        generating: "GENERATING",
        success: "SUCCESS",
        fail: "FAILED",
      };

      return {
        ok: true,
        taskId: (kieData.taskId as string | undefined) ?? taskId,
        state,
        status: statusMap[state] ?? "GENERATING",
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

    const systemMessage = `Ты — эксперт по составлению промптов для генерации видео с помощью ИИ (Sora).
Твоя задача: взять описание пользователя и превратить его в детальный, кинематографический промпт для видео.
Правила:
- Пиши улучшенный промпт ТОЛЬКО на русском языке
- Добавляй конкретные детали: движение камеры, освещение, динамика, стиль, настроение, скорость
- Добавляй кинематографические термины: "плавный дрон-шот", "крупный план", "медленное движение", "кинематографическое освещение"
- Описывай движение в кадре: что и как двигается, как меняется сцена
- Объём: 2–4 предложения, ёмко и описательно
- Верни ТОЛЬКО текст улучшенного промпта — без пояснений, без заголовков`;

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

      const improved = kieData.choices?.[0]?.message?.content?.trim();
      if (!improved) {
        return reply.status(500).send({ ok: false, error: kieData.error?.message || "Не удалось улучшить промпт" });
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
