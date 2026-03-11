export async function healthRoutes(app) {
    app.get("/health", async () => {
        return {
            ok: true,
            service: "ai-studio-api"
        };
    });
}
