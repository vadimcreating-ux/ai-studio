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
      credits_balance NUMERIC(12,4) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Migrate INTEGER → NUMERIC(12,4) on existing prod DB (safe, no data loss)
  await dbQuery(`
    ALTER TABLE users ALTER COLUMN credits_balance TYPE NUMERIC(12,4)
  `).catch(() => {});

  await dbQuery(`
    ALTER TABLE users ADD COLUMN storage_quota_mb INTEGER NOT NULL DEFAULT 500
  `).catch(() => {});

  await dbQuery(`
    ALTER TABLE users ADD COLUMN storage_used_mb NUMERIC(12,4) NOT NULL DEFAULT 0
  `).catch(() => {});

  await dbQuery(`
    ALTER TABLE users ADD COLUMN avatar_url TEXT
  `).catch(() => {});

  await dbQuery(`
    ALTER TABLE users ADD COLUMN jwt_version INTEGER NOT NULL DEFAULT 0
  `).catch(() => {});
}

export async function ensureCreditTransactionsTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(12,4) NOT NULL,
      type TEXT NOT NULL,
      operation TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Migrate INTEGER → NUMERIC(12,4) on existing prod DB (safe, no data loss)
  await dbQuery(`
    ALTER TABLE credit_transactions ALTER COLUMN amount TYPE NUMERIC(12,4)
  `).catch(() => {});

  await dbQuery(`ALTER TABLE credit_transactions ADD COLUMN kie_amount NUMERIC(10,4) NOT NULL DEFAULT 0`).catch(() => {});
  await dbQuery(`ALTER TABLE credit_transactions ADD COLUMN markup_percent NUMERIC(6,2) NOT NULL DEFAULT 0`).catch(() => {});
  await dbQuery(`ALTER TABLE credit_transactions ADD COLUMN group_name TEXT NOT NULL DEFAULT ''`).catch(() => {});
}

export async function ensureCreditPricesTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS credit_prices (
      operation TEXT PRIMARY KEY,
      credits INTEGER NOT NULL DEFAULT 0
    )
  `);

  await dbQuery(`
    ALTER TABLE credit_prices ADD COLUMN markup_percent NUMERIC(6,2) NOT NULL DEFAULT 0
  `).catch(() => {});

  // Seed default and model-specific prices (DO NOTHING = don't overwrite admin changes)
  await dbQuery(`
    INSERT INTO credit_prices (operation, credits) VALUES
      -- Chat (markup applied to real KIE credits_consumed)
      ('chat_claude',    0),
      ('chat_chatgpt',   0),
      ('chat_gemini',    0),
      ('prompt_improve', 0),

      -- Image: fallback default
      ('image_generate', 18),

      -- Nano Banana Pro (1K/2K = 18 cr, 4K = 24 cr)
      ('image_nano-banana-pro_1K', 18),
      ('image_nano-banana-pro_2K', 18),
      ('image_nano-banana-pro_4K', 24),

      -- Grok Imagine text-to-image (4 cr flat, 6 images)
      ('image_grok-imagine_text-to-image', 4),

      -- Seedream 4.5 (6.5 cr → 7)
      ('image_seedream_4_5-edit', 7),

      -- Z-Image Turbo (0.8 cr → 1)
      ('image_z-image', 1),

      -- Topaz Upscale (by upscale_factor: 1x=10, 2x=20, 4x=40, 8x=40)
      ('image_topaz_image-upscale_1', 10),
      ('image_topaz_image-upscale_2', 20),
      ('image_topaz_image-upscale_4', 40),
      ('image_topaz_image-upscale_8', 40),

      -- Recraft Remove Background (1 cr flat)
      ('image_recraft_remove-background', 1),

      -- Ideogram V3 Reframe (Balanced speed = 7 cr)
      ('image_ideogram_v3-reframe', 7),

      -- Video: fallback default
      ('video_generate', 30),

      -- Sora 2 Pro (720p, ~10s)
      ('video_sora-2-pro-image-to-video', 150),
      ('video_sora-2-pro-text-to-video',  150),

      -- Sora 2 Standard (~10s)
      ('video_sora-2-image-to-video', 30),
      ('video_sora-2-text-to-video',  30),

      -- Kling 3.0 Motion Control (Standard, ~5s, no audio: 5×14=70)
      ('video_kling-3_0_motion-control', 70)

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

  // Add attached_files to chat_messages (stores image dataUrls and file metadata)
  await dbQuery(`
    ALTER TABLE chat_messages ADD COLUMN attached_files JSONB DEFAULT NULL
  `).catch(() => {});

  // Add thinking_content to chat_messages (Claude extended thinking)
  await dbQuery(`
    ALTER TABLE chat_messages ADD COLUMN thinking_content TEXT DEFAULT NULL
  `).catch(() => {});

  // Migrate stale claude-sonnet-4-6 chats to the stable claude-sonnet-4-5
  await dbQuery(`
    UPDATE chats SET model = 'claude-sonnet-4-5' WHERE module = 'claude' AND model = 'claude-sonnet-4-6'
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

  await dbQuery(`
    ALTER TABLE files ADD COLUMN file_size_bytes BIGINT
  `).catch(() => {});

  await dbQuery(`
    ALTER TABLE files ADD COLUMN storage_url TEXT
  `).catch(() => {});

  await dbQuery(`
    ALTER TABLE files ADD COLUMN s3_key TEXT
  `).catch(() => {});

  await dbQuery(`
    ALTER TABLE files ADD COLUMN credits_spent NUMERIC(12,4)
  `).catch(() => {});
}
