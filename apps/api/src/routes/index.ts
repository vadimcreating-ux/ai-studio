import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health.js";
import { imageRoutes } from "./image.js";
import { videoRoutes } from "./video.js";
import { chatRoutes } from "./chat.js";
import { projectRoutes } from "./projects.js";
import { engineSettingsRoutes } from "./engine-settings.js";
import { authRoutes } from "./auth.js";
import { adminRoutes } from "./admin.js";
import { creditsRoutes } from "./credits.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(creditsRoutes);
  await app.register(adminRoutes);
  await app.register(imageRoutes);
  await app.register(videoRoutes);
  await app.register(chatRoutes);
  await app.register(projectRoutes);
  await app.register(engineSettingsRoutes);
}
