import type { FastifyInstance } from "fastify";
import {
  saveImageToFiles,
  getFiles,
  deleteFileById,
} from "../lib/files-store.js";

const KIE_BASE_URL = "https://api.kie.ai";
const imagePromptStore = new Map<string, string>();

export async function imageRoutes(app: FastifyInstance) {
  // Генерация изображения — создание задачи
  app.post("/api/image/generate", async (request, reply) => {
    const body = request.body as {
      model?: string;
      prompt?: string;
      image_input?: string[]; // URLs для image-to-image
      aspect_ratio?: string;
      resolution?: string;
      output_format?: string;
    };

    const prompt = body?.prompt?.trim();
    const apiKey = process.env.KIE_API_KEY;

    if (!apiKey) {
      return reply.status(500).send({ ok: false, error: "Не задан KIE_API_KEY" });
    }

    if (!prompt) {
      return reply.status(400).send({ ok: false, error: "Введите prompt" });
    }

    const model = body?.model?.trim() || "nano-banana-pro";

    const input: Record<string, unknown> = { prompt };
    if (body?.image_input?.length) input.image_input = body.image_input;
    if (body?.aspect_ratio) input.aspect_ratio = body.aspect_ratio;
    if (body?.resolution) input.resolution = body.resolution;
    if (body?.output_format) input.output_format = body.output_format;

    try {
      const createResponse = await fetch(
        `${KIE_BASE_URL}/api/v1/jobs/createTask`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, input }),
        }
      );

      const createData = await createResponse.json() as {
        code?: number;
        message?: string;
        data?: { taskId?: string };
      };

      if (!createResponse.ok || createData?.code !== 200 || !createData?.data?.taskId) {
        console.error("KIE image create error:", createResponse.status, JSON.stringify(createData));
        return reply.status(500).send({
          ok: false,
          error: createData?.message || "KIE не вернул taskId",
          debug: { status: createResponse.status, body: createData },
        });
      }

      const taskId = createData.data.taskId;
      imagePromptStore.set(taskId, prompt);

      return { ok: true, taskId };
    } catch {
      return reply.status(500).send({ ok: false, error: "Не удалось создать задачу в KIE" });
    }
  });

  // Проверка статуса задачи
  app.get("/api/image/status", async (request, reply) => {
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
        `${KIE_BASE_URL}/api/v1/jobs/queryTask?taskId=${encodeURIComponent(taskId)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      const statusData = await statusResponse.json() as {
        code?: number;
        message?: string;
        data?: {
          taskId?: string;
          successFlag?: number;
          errorMessage?: string;
          response?: { resultImageUrl?: string; resultImageUrls?: string[] };
        };
      };

      if (!statusResponse.ok || statusData?.code !== 200 || !statusData?.data) {
        console.error("KIE image status error:", statusResponse.status, JSON.stringify(statusData));
        return reply.status(500).send({
          ok: false,
          error: statusData?.message || "Не удалось получить статус задачи",
        });
      }

      const data = statusData.data;
      const successFlag = data.successFlag ?? 0;
      const resultImageUrl =
        data?.response?.resultImageUrl ||
        data?.response?.resultImageUrls?.[0] || "";

      if (successFlag === 1 && resultImageUrl) {
        await saveImageToFiles({
          taskId: data.taskId ?? taskId,
          url: resultImageUrl,
          prompt: imagePromptStore.get(taskId) || undefined,
        });
        imagePromptStore.delete(taskId);
      }

      const statusMap: Record<number, string> = {
        0: "GENERATING",
        1: "SUCCESS",
        2: "CREATE_TASK_FAILED",
        3: "GENERATE_FAILED",
      };

      return {
        ok: true,
        taskId: data.taskId ?? taskId,
        successFlag,
        status: statusMap[successFlag] ?? "UNKNOWN",
        imageUrl: resultImageUrl,
        errorMessage: data.errorMessage || "",
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
    } catch {
      return reply.status(500).send({ ok: false, error: "Ошибка при скачивании файла" });
    }
  });

  // Список файлов
  app.get("/api/files", async () => {
    return { ok: true, files: await getFiles() };
  });

  // Удаление файла
  app.delete("/api/files/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const id = params?.id?.trim();

    if (!id) {
      return reply.status(400).send({ ok: false, error: "Не передан id файла" });
    }

    const deleted = await deleteFileById(id);
    if (!deleted) {
      return reply.status(404).send({ ok: false, error: "Файл не найден" });
    }

    return { ok: true, id };
  });
}
