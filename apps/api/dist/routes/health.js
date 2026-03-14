export async function healthRoutes(app) {
    app.get("/health", async () => {
        return {
            ok: true,
            service: "ai-studio-api"
        };
    });
    app.get("/api/kie-balance", async () => {
        const apiKey = process.env.KIE_API_KEY;
        if (!apiKey)
            return { ok: true, balance: null, reason: "no_key" };
        try {
            // Официальный endpoint из документации KIE API
            const res = await fetch("https://api.kie.ai/api/v1/chat/credit", {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (!res.ok)
                return { ok: true, balance: null };
            // Ответ: { "code": 200, "msg": "success", "data": 100 }
            const data = await res.json();
            return { ok: true, balance: data.data ?? null };
        }
        catch {
            return { ok: true, balance: null };
        }
    });
}
