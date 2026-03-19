import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes/index.js";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
// 10 MB лимит на тело запроса (base64 файлы могут быть крупными)
const BODY_LIMIT = 10 * 1024 * 1024;
const isDev = process.env.NODE_ENV !== "production";
// Pino: в dev — pretty-print с цветами, в проде — JSON (structured logs для Timeweb)
const loggerConfig = isDev
    ? {
        level: "debug",
        transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
    }
    : {
        level: "info",
        // JSON-логи — в проде их собирает Timeweb, можно фильтровать по полям
        serializers: {
            req: (req) => ({
                method: req.method,
                url: req.url,
                hostname: req.hostname,
            }),
            res: (res) => ({ statusCode: res.statusCode }),
        },
    };
export function buildApp() {
    const app = Fastify({
        logger: loggerConfig,
        bodyLimit: BODY_LIMIT,
    });
    // CORS: в dev разрешаем всё, в проде — только явно заданный FRONTEND_URL (или same-origin)
    app.register(cors, {
        origin: isDev
            ? true
            : (process.env.FRONTEND_URL ?? false),
        credentials: true,
    });
    // Rate limiting: только для API-эндпоинтов (/api/*), статику не ограничиваем
    // 300 req/min — достаточно для нормального использования и E2E-тестов
    app.register(rateLimit, {
        max: 300,
        timeWindow: "1 minute",
        keyGenerator: (request) => request.ip,
        allowList: (request) => !request.url.startsWith("/api/"),
        errorResponseBuilder: (_req) => ({
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
