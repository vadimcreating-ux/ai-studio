import type { FastifyInstance } from "fastify";
import { saveImageToFiles, getFiles } from '../lib/files-store'
const KIE_BASE_URL = "https://api.kie.ai";

export async function imageRoutes(app: FastifyInstance) {
  app.post("/api/image/generate", async (request, reply) => {
    const body = request.body as {
      prompt?: string;
      negativePrompt?: string;
      size?: string;
      count?: string;
      style?: string;
      model?: string;
    };

    const prompt = body?.prompt?.trim();
    const apiKey = process.env.KIE_API_KEY;

    if (!apiKey) {
      return reply.status(500).send({
        ok: false,
        error: "Не задан KIE_API_KEY в переменных окружения Timeweb"
      });
    }

    if (!prompt) {
      return reply.status(400).send({
        ok: false,
        error: "Введите prompt"
      });
    }

    const sizeMap: Record<string, string> = {
      "1024 × 1024": "1:1",
      "1536 × 1024": "3:2",
      "1024 × 1536": "2:3"
    };

    const aspectRatio = sizeMap[body?.size || "1024 × 1024"] || "1:1";

    try {
      const createResponse = await fetch(
        `${KIE_BASE_URL}/api/v1/flux/kontext/generate`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt,
            enableTranslation: true,
            aspectRatio,
            outputFormat: "jpeg",
            promptUpsampling: false,
            model: "flux-kontext-pro",
            safetyTolerance: 2
          })
        }
      );

      const createData = await createResponse.json();

      if (!createResponse.ok || createData?.code !== 200 || !createData?.data?.taskId) {
        return reply.status(500).send({
          ok: false,
          error: createData?.msg || "KIE не вернул taskId"
        });
      }

      return {
  ok: true,
  taskId: createData.data.taskId,
  mode: "kie",
  debugVersion: "image-route-v3-files"
};
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        error: "Не удалось создать задачу в KIE"
      });
    }
  });

  app.get("/api/image/status", async (request, reply) => {
    const query = request.query as { taskId?: string };
    const taskId = query?.taskId?.trim();
    const apiKey = process.env.KIE_API_KEY;

    if (!apiKey) {
      return reply.status(500).send({
        ok: false,
        error: "Не задан KIE_API_KEY в переменных окружения Timeweb"
      });
    }

    if (!taskId) {
      return reply.status(400).send({
        ok: false,
        error: "Не передан taskId"
      });
    }

    try {
      const statusResponse = await fetch(
        `${KIE_BASE_URL}/api/v1/flux/kontext/record-info?taskId=${encodeURIComponent(taskId)}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${apiKey}`
          }
        }
      );

      const statusData = await statusResponse.json();

      if (!statusResponse.ok || statusData?.code !== 200 || !statusData?.data) {
        return reply.status(500).send({
          ok: false,
          error: statusData?.msg || "Не удалось получить статус задачи"
        });
      }

      const data = statusData.data;
      const successFlag = data.successFlag;
      const resultImageUrl = data?.response?.resultImageUrl || "";
if (successFlag === 1 && resultImageUrl) {
  saveImageToFiles({
    taskId: data.taskId,
    url: resultImageUrl,
  });
}
            return {
        ok: true,
        taskId: data.taskId,
        successFlag,
        status:
          successFlag === 0
            ? "GENERATING"
            : successFlag === 1
            ? "SUCCESS"
            : successFlag === 2
            ? "CREATE_TASK_FAILED"
            : "GENERATE_FAILED",
        imageUrl: resultImageUrl,
        errorMessage: data.errorMessage || ""
      };
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        error: "Не удалось проверить статус в KIE"
      });
    }
  });

  app.get("/api/files", async () => {
    return {
      ok: true,
      files: getFiles(),
    };
  });
}
