import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes/index.js";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
export function buildApp() {
    const app = Fastify({
        logger: true,
    });
    // Регистрируем API-маршруты
    app.register(registerRoutes);
    // Путь к собранному фронтенду: apps/web/dist
    // Из apps/api/dist/server.js → ../../web/dist
    const webDistPath = path.join(__dirname, "../../web/dist");
    if (fs.existsSync(webDistPath)) {
        // Раздаём статические файлы (JS, CSS, картинки) — с долгим кешем (content-hashed имена)
        app.register(fastifyStatic, {
            root: webDistPath,
            prefix: "/",
        });
        // Все маршруты которые не нашли файл → отдаём index.html (React Router)
        // index.html не кешируем, чтобы браузер сразу видел новый бандл
        app.setNotFoundHandler((_req, reply) => {
            reply
                .header("Cache-Control", "no-cache, no-store, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .sendFile("index.html");
        });
    }
    else {
        app.log.warn(`Frontend build not found at ${webDistPath}. Run: npm run build:web`);
    }
    return app;
}
