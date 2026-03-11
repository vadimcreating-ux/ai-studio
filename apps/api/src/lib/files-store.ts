import { randomUUID } from "node:crypto";
import { dbQuery } from "./db.js";

export type FileItem = {
  id: string;
  taskId: string;
  type: "image";
  name: string;
  url: string;
  createdAt: string;
  source: "kie";
};

function mapRowToFileItem(row: any): FileItem {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type,
    name: row.name,
    url: row.url,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    source: row.source,
  };
}

export async function saveImageToFiles(data: {
  taskId: string;
  url: string;
}): Promise<FileItem> {
  const existing = await dbQuery(
    `
      SELECT id, task_id, type, name, url, created_at, source
      FROM files
      WHERE task_id = $1
      LIMIT 1
    `,
    [data.taskId]
  );

  if (existing.rows[0]) {
    return mapRowToFileItem(existing.rows[0]);
  }

  const id = randomUUID();
  const name = `image-${Date.now()}.png`;

  const inserted = await dbQuery(
    `
      INSERT INTO files (id, task_id, type, name, url, created_at, source)
      VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      ON CONFLICT (task_id) DO NOTHING
      RETURNING id, task_id, type, name, url, created_at, source
    `,
    [id, data.taskId, "image", name, data.url, "kie"]
  );

  if (inserted.rows[0]) {
    return mapRowToFileItem(inserted.rows[0]);
  }

  const fallback = await dbQuery(
    `
      SELECT id, task_id, type, name, url, created_at, source
      FROM files
      WHERE task_id = $1
      LIMIT 1
    `,
    [data.taskId]
  );

  return mapRowToFileItem(fallback.rows[0]);
}

export async function getFiles(): Promise<FileItem[]> {
  const result = await dbQuery(
    `
      SELECT id, task_id, type, name, url, created_at, source
      FROM files
      ORDER BY created_at DESC
    `
  );

  return result.rows.map(mapRowToFileItem);
}
