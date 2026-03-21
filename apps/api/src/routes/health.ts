import type { FastifyInstance } from "fastify";
import { authenticate, requireAdmin } from "../lib/auth.js";

export async function healthRoutes(app: FastifyInstance) {
  // Public health check — no auth
  app.get("/health", async () => {
    return { ok: true, service: "ai-studio-api" };
  });

  // KIE Claude test — admin only, temporary debug endpoint
  app.get("/api/kie-claude-test", { preHandler: [authenticate, requireAdmin] }, async () => {
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return { ok: false, error: "no_key" };
    try {
      const res = await fetch("https://api.kie.ai/claude/v1/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-5", messages: [{ role: "user", content: "hi" }], max_tokens: 8096, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      return { ok: true, httpStatus: res.status, body: text };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

  // KIE balance — admin only
  app.get("/api/kie-balance", { preHandler: [authenticate, requireAdmin] }, async () => {
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return { ok: true, balance: null, reason: "no_key" };

    try {
      const res = await fetch("https://api.kie.ai/api/v1/chat/credit", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return { ok: true, balance: null };
      const data = await res.json() as { code?: number; msg?: string; data?: unknown };
      return { ok: true, balance: data.data ?? null };
    } catch {
      return { ok: true, balance: null };
    }
  });
}
