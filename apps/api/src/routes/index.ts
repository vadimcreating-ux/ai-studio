import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health.js";
import { imageRoutes } from "./image.js";
import { videoRoutes } from "./video.js";
import { chatRoutes } from "./chat.js";
import { projectRoutes } from "./projects.js";

// rootRoutes removed — React frontend handles all UI routing now

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(imageRoutes);
  await app.register(videoRoutes);
  await app.register(chatRoutes);
  await app.register(projectRoutes);
}
