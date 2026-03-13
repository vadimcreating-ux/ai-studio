import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      ok: true,
      service: "ai-studio-api"
    };
  });

  app.get("/api/kie-balance", async () => {
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return { ok: false, balance: null };

    try {
      const res = await fetch("https://api.kie.ai/v1/credits", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return { ok: false, balance: null };
      const data = await res.json() as Record<string, unknown>;
      const balance = data.credits ?? data.balance ?? data.remaining ?? null;
      return { ok: true, balance };
    } catch {
      return { ok: false, balance: null };
    }
  });
}
