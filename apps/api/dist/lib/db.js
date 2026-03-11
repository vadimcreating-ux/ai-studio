import { Pool } from "pg";
export const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSLMODE === "require"
        ? { rejectUnauthorized: false }
        : undefined,
});
export async function dbQuery(text, params = []) {
    return pool.query(text, params);
}
export async function ensureChatsTable() {
    await dbQuery(`
    CREATE TABLE IF NOT EXISTS chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module TEXT NOT NULL,
      model TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Новый чат',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
    await dbQuery(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
export async function ensureProjectsTable() {
    await dbQuery(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      model TEXT DEFAULT '',
      system_prompt TEXT DEFAULT '',
      style TEXT DEFAULT '',
      memory TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
    await dbQuery(`
    ALTER TABLE chats ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL
  `).catch(() => { });
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
    )
  `);
    await dbQuery(`
    ALTER TABLE files
    ADD CONSTRAINT files_task_id_unique UNIQUE (task_id)
  `).catch(() => {
        // ограничение уже существует — это нормально
    });
    await dbQuery(`
    ALTER TABLE files
    ADD COLUMN prompt TEXT
  `).catch(() => {
        // колонка уже существует — это нормально
    });
}
