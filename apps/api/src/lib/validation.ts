import { z } from "zod";

// ─── Chat ────────────────────────────────────────────────────────────────────

export const CreateChatSchema = z.object({
  module: z.string().trim().min(1).max(50).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  title: z.string().trim().min(1).max(500).optional(),
  project_id: z.string().uuid().nullish(),
});

export const UpdateChatSchema = z.object({
  model: z.string().trim().min(1).max(100).optional(),
  title: z.string().trim().min(1).max(500).optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export const KieFileSchema = z.object({
  dataUrl: z.string().min(1),
  mimeType: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
});

export const SendMessageSchema = z.object({
  message: z.string().trim().min(1).max(100_000),
  files: z.array(KieFileSchema).max(10).optional(),
  webSearch: z.boolean().optional(),
});

export const EditMessageSchema = z.object({
  content: z.string().trim().min(1).max(100_000),
});

export const ChatListQuerySchema = z.object({
  module: z.string().trim().min(1).max(50).optional(),
  project_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Projects ────────────────────────────────────────────────────────────────

const ContextFileSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  dataUrl: z.string().min(1),
});

export const CreateProjectSchema = z.object({
  module: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  model: z.string().trim().max(100).optional(),
  system_prompt: z.string().trim().max(50_000).optional(),
  style: z.string().trim().max(1000).optional(),
  memory: z.string().trim().max(50_000).optional(),
  context_files: z.array(ContextFileSchema).max(20).optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.omit({ module: true }).partial();

// ─── Engine Settings ─────────────────────────────────────────────────────────

export const VALID_ENGINES = ["claude", "chatgpt", "gemini"] as const;

export const UpdateEngineSettingsSchema = z.object({
  about: z.string().trim().max(10_000).optional(),
  instructions: z.string().trim().max(50_000).optional(),
  memory: z.string().trim().max(50_000).optional(),
});

// ─── Files pagination ────────────────────────────────────────────────────────

export const FilesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100),
});

export const LoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

// ─── Admin ────────────────────────────────────────────────────────────────────

export const AdminAddCreditsSchema = z.object({
  amount: z.number().int().min(1).max(1_000_000),
  description: z.string().trim().max(500).optional(),
});

export const AdminUpdateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["admin", "user"]).optional(),
  is_active: z.boolean().optional(),
  credits_balance: z.number().int().min(0).optional(),
});

export const AdminUpdateCreditPriceSchema = z.object({
  credits: z.number().int().min(0).max(10_000),
  markup_percent: z.number().min(0).max(1000).optional(),
});

export const AdminUpdateStorageSchema = z.object({
  storage_quota_mb: z.number().int().min(0).max(100_000),
});

export const AdminCreateUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "user"]).default("user"),
  credits_balance: z.number().int().min(0).default(0),
});

export const AdminResetPasswordSchema = z.object({
  new_password: z.string().min(8).max(128),
});
