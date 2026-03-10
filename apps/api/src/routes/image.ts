import type { FastifyInstance } from "fastify";

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

    if (!prompt) {
      return reply.status(400).send({
        ok: false,
        error: "Введите prompt"
      });
    }

    return {
      ok: true,
      taskId: `img_${Date.now()}`,
      mode: "mock",
      result: {
        title: "Тестовый результат генерации",
        prompt,
        negativePrompt: body?.negativePrompt || "",
        size: body?.size || "1024 × 1024",
        count: body?.count || "1",
        style: body?.style || "Photoreal",
        model: body?.model || "KIE Image Model",
        previewText: "Здесь позже будет реальное изображение из KIE API"
      }
    };
  });
}
