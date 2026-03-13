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
    if (!apiKey) return { ok: true, balance: null, reason: "no_key" };

    // Try known KIE API balance endpoints
    const endpoints = [
      "https://api.kie.ai/v1/user/credits",
      "https://api.kie.ai/v1/credits",
      "https://api.kie.ai/v1/account",
      "https://api.kie.ai/v1/me",
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) continue;
        const data = await res.json() as Record<string, unknown>;
        const balance =
          data.credits ?? data.balance ?? data.remaining ??
          (data.data as Record<string, unknown>)?.credits ??
          (data.data as Record<string, unknown>)?.balance ?? null;
        if (balance !== null) return { ok: true, balance };
      } catch {
        // try next
      }
    }

    return { ok: true, balance: null, reason: "not_found" };
  });
}
