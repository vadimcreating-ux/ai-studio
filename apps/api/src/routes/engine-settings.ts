import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";

export async function engineSettingsRoutes(app: FastifyInstance) {
  // Получить настройки движка
  app.get("/api/engine-settings/:engine", async (request) => {
    const { engine } = request.params as { engine: string };

    const result = await dbQuery(
      `SELECT * FROM engine_settings WHERE engine = $1`,
      [engine]
    );

    if (result.rows.length === 0) {
      return { ok: true, settings: { engine, about: "", instructions: "", memory: "" } };
    }

    return { ok: true, settings: result.rows[0] };
  });

  // Сохранить / обновить настройки движка
  app.put("/api/engine-settings/:engine", async (request) => {
    const { engine } = request.params as { engine: string };
    const body = request.body as { about?: string; instructions?: string; memory?: string };

    const about = body?.about ?? "";
    const instructions = body?.instructions ?? "";
    const memory = body?.memory ?? "";

    await dbQuery(
      `INSERT INTO engine_settings (engine, about, instructions, memory, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (engine) DO UPDATE
         SET about = EXCLUDED.about,
             instructions = EXCLUDED.instructions,
             memory = EXCLUDED.memory,
             updated_at = now()`,
      [engine, about, instructions, memory]
    );

    return { ok: true, settings: { engine, about, instructions, memory } };
  });
}
