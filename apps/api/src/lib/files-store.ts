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

type FileRow = {
  id: string;
  task_id: string;
  type: string;
  name: string;
  url: string;
  created_at: string | Date;
  source: string;
};

function mapRowToFileItem(row: FileRow): FileItem {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type as "image",
    name: row.name,
    url: row.url,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    source: row.source as "kie",
  };
}

export async function saveImageToFiles(data: {
  taskId: string;
  url: string;
}) {
  const result = await dbQuery(
    `
      INSERT INTO files (
        id,
        task_id,
        type,
        name,
        url,
        created_at,
        source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (task_id)
      DO UPDATE SET url = EXCLUDED.url
      RETURNING id, task_id, type, name, url, created_at, source;
    `,
    [
      randomUUID(),
      data.taskId,
      "image",
      `image-${Date.now()}.png`,
      data.url,
      new Date().toISOString(),
      "kie",
    ]
  );

  return mapRowToFileItem(result.rows[0] as FileRow);
}

export async function getFiles() {
  const result = await dbQuery(
    `
      SELECT id, task_id, type, name, url, created_at, source
      FROM files
      ORDER BY created_at DESC;
    `
  );

  return result.rows.map((row) => mapRowToFileItem(row as FileRow));
}
