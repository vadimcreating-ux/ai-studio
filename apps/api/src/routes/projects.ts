import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";
import { CreateProjectSchema, UpdateProjectSchema } from "../lib/validation.js";


export async function projectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/api/projects", async (request) => {
    const user = request.authUser!;
    const query = request.query as { module?: string };
    const module = query?.module?.trim() || "claude";

    const result = user.role === "admin"
      ? await dbQuery(
          `SELECT * FROM projects WHERE module = $1 ORDER BY created_at ASC`,
          [module]
        )
      : await dbQuery(
          `SELECT * FROM projects WHERE module = $1 AND (user_id = $2 OR user_id IS NULL) ORDER BY created_at ASC`,
          [module, user.userId]
        );

    return { ok: true, projects: result.rows };
  });

  app.post("/api/projects", async (request, reply) => {
    const user = request.authUser!;
    const parsed = CreateProjectSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
    const body = parsed.data;

    const result = await dbQuery(
      `INSERT INTO projects (module, name, description, model, system_prompt, style, memory, context_files, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        body.module ?? "claude",
        body.name,
        body.description ?? "",
        body.model ?? "",
        body.system_prompt ?? "",
        body.style ?? "",
        body.memory ?? "",
        JSON.stringify(body.context_files ?? []),
        user.userId,
      ]
    );

    return { ok: true, project: result.rows[0] };
  });

  app.put<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const user = request.authUser!;
    const { id } = request.params;
    const parsed = UpdateProjectSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
    const body = parsed.data;

    const updateParams = [
      body.name ?? null,
      body.description ?? null,
      body.model ?? null,
      body.system_prompt ?? null,
      body.style ?? null,
      body.memory ?? null,
      body.context_files !== undefined ? JSON.stringify(body.context_files) : null,
      id,
    ];

    const result = user.role === "admin"
      ? await dbQuery(
          `UPDATE projects
           SET
             name = COALESCE($1, name),
             description = COALESCE($2, description),
             model = COALESCE($3, model),
             system_prompt = COALESCE($4, system_prompt),
             style = COALESCE($5, style),
             memory = COALESCE($6, memory),
             context_files = COALESCE($7, context_files)
           WHERE id = $8 RETURNING *`,
          updateParams
        )
      : await dbQuery(
          `UPDATE projects
           SET
             name = COALESCE($1, name),
             description = COALESCE($2, description),
             model = COALESCE($3, model),
             system_prompt = COALESCE($4, system_prompt),
             style = COALESCE($5, style),
             memory = COALESCE($6, memory),
             context_files = COALESCE($7, context_files)
           WHERE id = $8 AND (user_id = $9 OR user_id IS NULL) RETURNING *`,
          [...updateParams, user.userId]
        );

    if (result.rows.length === 0) {
      return reply.status(404).send({ ok: false, error: "Проект не найден" });
    }

    return { ok: true, project: result.rows[0] };
  });

  app.delete<{ Params: { id: string }; Querystring: { moveChats?: string } }>("/api/projects/:id", async (request) => {
    const user = request.authUser!;
    const { id } = request.params;
    const { moveChats: moveChatsStr } = request.query;
    const moveChats = moveChatsStr === "true";
    if (moveChats) {
      // Move all chats in this project to "Черновики" (project_id = null)
      await dbQuery(`UPDATE chats SET project_id = NULL WHERE project_id = $1`, [id]);
    }

    user.role === "admin"
      ? await dbQuery(`DELETE FROM projects WHERE id = $1`, [id])
      : await dbQuery(`DELETE FROM projects WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`, [id, user.userId]);
    return { ok: true };
  });
}
