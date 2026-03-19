import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes/index.js";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
// 10 MB лимит на тело запроса (base64 файлы могут быть крупными)
const BODY_LIMIT = 10 * 1024 * 1024;
export function buildApp() {
    const app = Fastify({
        logger: true,
        bodyLimit: BODY_LIMIT,
    });
    // Rate limiting: 60 запросов в минуту на IP
    app.register(rateLimit, {
        max: 60,
        timeWindow: "1 minute",
        errorResponseBuilder: () => ({
            ok: false,
            error: "Слишком много запросов. Подождите немного и попробуйте снова.",
        }),
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
