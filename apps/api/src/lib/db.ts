import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl:
    process.env.PGSSLMODE === "require"
      ? { rejectUnauthorized: false }
      : undefined,
});

export async function dbQuery(text: string, params: unknown[] = []) {
  return pool.query(text, params);
}

export async function ensureFilesTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS files (
      id UUID PRIMARY KEY,
      task_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      source TEXT NOT NULL
    );
  `);
}
