import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health.js";
import { rootRoutes } from "./root.js";
import { imageRoutes } from "./image.js";
import { chatRoutes } from "./chat.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(rootRoutes);
  await app.register(healthRoutes);
  await app.register(imageRoutes);
  await app.register(chatRoutes);
}
