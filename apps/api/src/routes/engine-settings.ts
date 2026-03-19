import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { VALID_ENGINES, UpdateEngineSettingsSchema } from "../lib/validation.js";

export async function engineSettingsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/api/engine-settings/:engine", async (request, reply) => {
    const { engine } = request.params as { engine: string };

    if (!VALID_ENGINES.includes(engine as typeof VALID_ENGINES[number])) {
      return reply.status(400).send({ ok: false, error: "Неизвестный движок" });
    }

    const result = await dbQuery(
      `SELECT * FROM engine_settings WHERE engine = $1`,
      [engine]
    );

    if (result.rows.length === 0) {
      return { ok: true, settings: { engine, about: "", instructions: "", memory: "" } };
    }

    return { ok: true, settings: result.rows[0] };
  });

  app.put("/api/engine-settings/:engine", { preHandler: [requireAdmin] }, async (request, reply) => {
    const { engine } = request.params as { engine: string };

    if (!VALID_ENGINES.includes(engine as typeof VALID_ENGINES[number])) {
      return reply.status(400).send({ ok: false, error: "Неизвестный движок" });
    }

    const parsed = UpdateEngineSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });

    const about = parsed.data.about ?? "";
    const instructions = parsed.data.instructions ?? "";
    const memory = parsed.data.memory ?? "";

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
