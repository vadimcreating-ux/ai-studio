import { randomUUID } from "node:crypto";
import { dbQuery } from "./db.js";
function mapRowToFileItem(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        type: row.type,
        name: row.name,
        url: row.url,
        createdAt: row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
        source: row.source,
        prompt: row.prompt ?? null,
    };
}
export async function saveImageToFiles(data) {
    const existing = await dbQuery(`
      SELECT id, task_id, type, name, url, created_at, source, prompt
      FROM files
      WHERE task_id = $1
      LIMIT 1
    `, [data.taskId]);
    if (existing.rows[0]) {
        return mapRowToFileItem(existing.rows[0]);
    }
    const id = randomUUID();
    const name = `image-${Date.now()}.png`;
    const inserted = await dbQuery(`
      INSERT INTO files (id, task_id, type, name, url, created_at, source, prompt)
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
      ON CONFLICT (task_id) DO NOTHING
      RETURNING id, task_id, type, name, url, created_at, source, prompt
    `, [id, data.taskId, "image", name, data.url, "kie", data.prompt || null]);
    if (inserted.rows[0]) {
        return mapRowToFileItem(inserted.rows[0]);
    }
    const fallback = await dbQuery(`
      SELECT id, task_id, type, name, url, created_at, source, prompt
      FROM files
      WHERE task_id = $1
      LIMIT 1
    `, [data.taskId]);
    return mapRowToFileItem(fallback.rows[0]);
}
export async function getFiles() {
    const result = await dbQuery(`
      SELECT id, task_id, type, name, url, created_at, source, prompt
      FROM files
      ORDER BY created_at DESC
    `);
    return result.rows.map(mapRowToFileItem);
}
export async function deleteFileById(id) {
    const result = await dbQuery(`
      DELETE FROM files
      WHERE id = $1
    `, [id]);
    return (result.rowCount ?? 0) > 0;
}
