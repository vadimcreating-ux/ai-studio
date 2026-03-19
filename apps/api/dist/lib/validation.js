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
export const VALID_ENGINES = ["claude", "chatgpt", "gemini"];
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
