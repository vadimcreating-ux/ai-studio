import { dbQuery } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";
import { CreateProjectSchema, UpdateProjectSchema } from "../lib/validation.js";
export async function projectRoutes(app) {
    app.addHook("preHandler", authenticate);
    app.get("/api/projects", async (request) => {
        const user = request.authUser;
        const query = request.query;
        const module = query?.module?.trim() || "claude";
        const userFilter = user.role === "admin" ? "" : `AND (user_id = '${user.userId}' OR user_id IS NULL)`;
        const result = await dbQuery(`SELECT * FROM projects WHERE module = $1 ${userFilter} ORDER BY created_at ASC`, [module]);
        return { ok: true, projects: result.rows };
    });
    app.post("/api/projects", async (request, reply) => {
        const user = request.authUser;
        const parsed = CreateProjectSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
        const body = parsed.data;
        const result = await dbQuery(`INSERT INTO projects (module, name, description, model, system_prompt, style, memory, context_files, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [
            body.module ?? "claude",
            body.name,
            body.description ?? "",
            body.model ?? "",
            body.system_prompt ?? "",
            body.style ?? "",
            body.memory ?? "",
            JSON.stringify(body.context_files ?? []),
            user.userId,
        ]);
        return { ok: true, project: result.rows[0] };
    });
    app.put("/api/projects/:id", async (request, reply) => {
        const user = request.authUser;
        const params = request.params;
        const parsed = UpdateProjectSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
        const body = parsed.data;
        const ownerCheck = user.role === "admin" ? "" : `AND (user_id = '${user.userId}' OR user_id IS NULL)`;
        const result = await dbQuery(`UPDATE projects
       SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         model = COALESCE($3, model),
         system_prompt = COALESCE($4, system_prompt),
         style = COALESCE($5, style),
         memory = COALESCE($6, memory),
         context_files = COALESCE($7, context_files)
       WHERE id = $8 ${ownerCheck} RETURNING *`, [
            body.name ?? null,
            body.description ?? null,
            body.model ?? null,
            body.system_prompt ?? null,
            body.style ?? null,
            body.memory ?? null,
            body.context_files !== undefined ? JSON.stringify(body.context_files) : null,
            params.id,
        ]);
        if (result.rows.length === 0) {
            return reply.status(404).send({ ok: false, error: "Проект не найден" });
        }
        return { ok: true, project: result.rows[0] };
    });
    app.delete("/api/projects/:id", async (request) => {
        const user = request.authUser;
        const params = request.params;
        const ownerCheck = user.role === "admin" ? "" : `AND (user_id = '${user.userId}' OR user_id IS NULL)`;
        await dbQuery(`DELETE FROM projects WHERE id = $1 ${ownerCheck}`, [params.id]);
        return { ok: true };
    });
}
