import { authenticate, requireAdmin } from "../lib/auth.js";
export async function healthRoutes(app) {
    // Public health check — no auth
    app.get("/health", async () => {
        return { ok: true, service: "ai-studio-api" };
    });
    // KIE balance — admin only
    app.get("/api/kie-balance", { preHandler: [authenticate, requireAdmin] }, async () => {
        const apiKey = process.env.KIE_API_KEY;
        if (!apiKey)
            return { ok: true, balance: null, reason: "no_key" };
        try {
            const res = await fetch("https://api.kie.ai/api/v1/chat/credit", {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (!res.ok)
                return { ok: true, balance: null };
            const data = await res.json();
            return { ok: true, balance: data.data ?? null };
        }
        catch {
            return { ok: true, balance: null };
        }
    });
}
