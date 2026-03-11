import { dbQuery } from "../lib/db.js";
export async function projectRoutes(app) {
    app.get("/api/projects", async (request) => {
        const query = request.query;
        const module = query?.module?.trim() || "claude";
        const result = await dbQuery(`SELECT * FROM projects WHERE module = $1 ORDER BY created_at ASC`, [module]);
        return { ok: true, projects: result.rows };
    });
    app.post("/api/projects", async (request, reply) => {
        const body = request.body;
        const module = body?.module?.trim() || "claude";
        const name = body?.name?.trim();
        if (!name) {
            return reply.status(400).send({ ok: false, error: "Не указано имя проекта" });
        }
        const result = await dbQuery(`INSERT INTO projects (module, name, description, model, system_prompt, style, memory)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [
            module,
            name,
            body?.description || "",
            body?.model || "",
            body?.system_prompt || "",
            body?.style || "",
            body?.memory || "",
        ]);
        return { ok: true, project: result.rows[0] };
    });
    app.put("/api/projects/:id", async (request, reply) => {
        const params = request.params;
        const body = request.body;
        const result = await dbQuery(`UPDATE projects
       SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         model = COALESCE($3, model),
         system_prompt = COALESCE($4, system_prompt),
         style = COALESCE($5, style),
         memory = COALESCE($6, memory)
       WHERE id = $7 RETURNING *`, [
            body?.name ?? null,
            body?.description ?? null,
            body?.model ?? null,
            body?.system_prompt ?? null,
            body?.style ?? null,
            body?.memory ?? null,
            params.id,
        ]);
        if (result.rows.length === 0) {
            return reply.status(404).send({ ok: false, error: "Проект не найден" });
        }
        return { ok: true, project: result.rows[0] };
    });
    app.delete("/api/projects/:id", async (request) => {
        const params = request.params;
        await dbQuery(`DELETE FROM projects WHERE id = $1`, [params.id]);
        return { ok: true };
    });
}
