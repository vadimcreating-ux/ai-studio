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
    // Раздаём статические файлы (JS, CSS, картинки)
    app.register(fastifyStatic, {
      root: webDistPath,
      prefix: "/",
      // Не перехватываем /api и /health
      decorateReply: false,
    });

    // Все остальные маршруты → index.html (для React Router)
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile("index.html", webDistPath);
    });
  } else {
    app.log.warn(
      `Frontend build not found at ${webDistPath}. Run: npm run build:web`
    );
  }

  return app;
}
