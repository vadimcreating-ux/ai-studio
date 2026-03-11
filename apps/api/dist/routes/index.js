import { healthRoutes } from "./health.js";
import { imageRoutes } from "./image.js";
import { chatRoutes } from "./chat.js";
import { projectRoutes } from "./projects.js";
// rootRoutes removed — React frontend handles all UI routing now
export async function registerRoutes(app) {
    await app.register(healthRoutes);
    await app.register(imageRoutes);
    await app.register(chatRoutes);
    await app.register(projectRoutes);
}
