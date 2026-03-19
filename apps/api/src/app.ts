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
      serializers: {
        req: (req: { method: string; url: string; hostname: string }) => ({
          method: req.method,
          url: req.url,
          hostname: req.hostname,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    };

export function buildApp() {
  const app = Fastify({
    logger: loggerConfig,
    bodyLimit: BODY_LIMIT,
    // Доверяем первому прокси (Timeweb) для корректного определения IP
    trustProxy: true,
  });

  // CORS: в dev разрешаем всё, в проде — только явно заданный FRONTEND_URL (или same-origin)
  app.register(cors, {
    origin: isDev
      ? true
      : (process.env.FRONTEND_URL ?? false),
    credentials: true,
  });

  // Rate limiting: global: false — применяется ТОЛЬКО к маршрутам с явным config.rateLimit
  // Глобальный лимит по IP нежизнеспособен за прокси Timeweb (shared IP)
  // Лимиты стоят только на дорогих операциях: отправка сообщений, генерация медиа
  app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({
      ok: false,
      error: "Слишком много запросов. Подождите немного и попробуйте снова.",
    }),
  });

  // Регистрируем API-маршруты
  app.register(registerRoutes);

  // Путь к собранному фронтенду: apps/web/dist
  const webDistPath = path.join(__dirname, "../../web/dist");

  if (fs.existsSync(webDistPath)) {
    app.register(fastifyStatic, {
      root: webDistPath,
      prefix: "/",
    });

    app.setNotFoundHandler((_req, reply) => {
      reply
        .header("Cache-Control", "no-cache, no-store, must-revalidate")
        .header("Pragma", "no-cache")
        .header("Expires", "0")
        .sendFile("index.html");
    });
  } else {
    app.log.warn(
      `Frontend build not found at ${webDistPath}. Run: npm run build:web`
    );
  }

  return app;
}
