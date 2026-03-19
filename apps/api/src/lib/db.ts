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

export async function ensureUsersTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      is_active BOOLEAN NOT NULL DEFAULT true,
      credits_balance INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function ensureCreditTransactionsTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      operation TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function ensureCreditPricesTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS credit_prices (
      operation TEXT PRIMARY KEY,
      credits INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Seed default prices if table is empty
  await dbQuery(`
    INSERT INTO credit_prices (operation, credits) VALUES
      ('chat_claude', 10),
      ('chat_chatgpt', 8),
      ('chat_gemini', 5),
      ('image_generate', 50),
      ('video_generate', 200),
      ('prompt_improve', 2)
    ON CONFLICT (operation) DO NOTHING
  `);
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

  // Add user_id to chats (nullable for backwards compat with existing data)
  await dbQuery(`
    ALTER TABLE chats ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL
  `).catch(() => {});
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
  `).catch(() => {});

  await dbQuery(`
    ALTER TABLE projects ADD COLUMN context_files JSONB DEFAULT '[]'
  `).catch(() => {});

  // Add user_id to projects (nullable for backwards compat)
  await dbQuery(`
    ALTER TABLE projects ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL
  `).catch(() => {});
}

export async function ensureImageTemplatesTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS image_prompt_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function ensureVideoTemplatesTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS video_prompt_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function ensureEngineSettingsTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS engine_settings (
      engine TEXT PRIMARY KEY,
      about TEXT DEFAULT '',
      instructions TEXT DEFAULT '',
      memory TEXT DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
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

  // Add user_id to files (nullable for backwards compat)
  await dbQuery(`
    ALTER TABLE files ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL
  `).catch(() => {});
}
