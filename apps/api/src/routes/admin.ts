import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";
import { authenticate, requireAdmin, hashPassword } from "../lib/auth.js";
import {
  AdminAddCreditsSchema,
  AdminUpdateUserSchema,
  AdminUpdateCreditPriceSchema,
  AdminUpdateStorageSchema,
  AdminCreateUserSchema,
  AdminResetPasswordSchema,
} from "../lib/validation.js";


export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require auth + admin role
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireAdmin);

  // ─── Users ───────────────────────────────────────────────────────────────

  // GET /api/admin/users
  app.get("/api/admin/users", async (_req, reply) => {
    const result = await dbQuery(
      "SELECT id, email, name, role, is_active, credits_balance, storage_quota_mb, storage_used_mb, created_at FROM users ORDER BY created_at DESC"
    );
    return reply.send({ ok: true, data: result.rows });
  });

  // POST /api/admin/users — create a new user (or admin)
  app.post("/api/admin/users", async (req, reply) => {
    const parsed = AdminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
    }
    const { email, password, name, role, credits_balance } = parsed.data;

    const existing = await dbQuery("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return reply.status(409).send({ ok: false, error: "Пользователь с таким email уже существует" });
    }

    const passwordHash = await hashPassword(password);
    const result = await dbQuery(
      "INSERT INTO users (email, password_hash, name, role, credits_balance) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, is_active, credits_balance, storage_quota_mb, storage_used_mb, created_at",
      [email.toLowerCase(), passwordHash, name, role, credits_balance]
    );
    return reply.status(201).send({ ok: true, data: result.rows[0] });
  });

  // GET /api/admin/users/:id
  app.get("/api/admin/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await dbQuery(
      "SELECT id, email, name, role, is_active, credits_balance, storage_quota_mb, storage_used_mb, created_at FROM users WHERE id = $1",
      [id]
    );
    if (!result.rows[0]) return reply.status(404).send({ ok: false, error: "Пользователь не найден" });
    return reply.send({ ok: true, data: result.rows[0] });
  });

  // PATCH /api/admin/users/:id — update user fields
  app.patch("/api/admin/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = AdminUpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
    }
    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ ok: false, error: "Нет полей для обновления" });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = $${i++}`);
      values.push(val);
    }
    values.push(id);

    const result = await dbQuery(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${i} RETURNING id, email, name, role, is_active, credits_balance, storage_quota_mb, storage_used_mb, created_at`,
      values
    );
    if (!result.rows[0]) return reply.status(404).send({ ok: false, error: "Пользователь не найден" });
    return reply.send({ ok: true, data: result.rows[0] });
  });

  // DELETE /api/admin/users/:id — delete user (cannot delete self)
  app.delete("/api/admin/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.authUser!.userId) {
      return reply.status(400).send({ ok: false, error: "Нельзя удалить собственный аккаунт" });
    }
    const result = await dbQuery("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
    if (!result.rows[0]) return reply.status(404).send({ ok: false, error: "Пользователь не найден" });
    return reply.send({ ok: true, data: null });
  });

  // PATCH /api/admin/users/:id/password — reset user password
  app.patch("/api/admin/users/:id/password", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = AdminResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
    }
    const newHash = await hashPassword(parsed.data.new_password);
    // Increment jwt_version to invalidate all sessions for that user
    const result = await dbQuery(
      "UPDATE users SET password_hash = $1, jwt_version = jwt_version + 1 WHERE id = $2 RETURNING id",
      [newHash, id]
    );
    if (!result.rows[0]) return reply.status(404).send({ ok: false, error: "Пользователь не найден" });
    return reply.send({ ok: true, data: null });
  });

  // POST /api/admin/users/:id/credits — add/remove credits
  app.post("/api/admin/users/:id/credits", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = AdminAddCreditsSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
    }
    const { amount, description } = parsed.data;
    const adminUser = req.authUser!;

    await dbQuery(
      "UPDATE users SET credits_balance = credits_balance + $1 WHERE id = $2",
      [amount, id]
    );
    await dbQuery(
      "INSERT INTO credit_transactions (user_id, amount, type, operation, description) VALUES ($1, $2, 'admin_add', 'admin_add', $3)",
      [id, amount, description ?? `Начисление от администратора (${adminUser.email})`]
    );

    const result = await dbQuery("SELECT credits_balance FROM users WHERE id = $1", [id]);
    return reply.send({ ok: true, data: { credits_balance: result.rows[0]?.credits_balance } });
  });

  // PATCH /api/admin/users/:id/storage — set storage quota
  app.patch("/api/admin/users/:id/storage", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = AdminUpdateStorageSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
    }
    const { storage_quota_mb } = parsed.data;
    const result = await dbQuery(
      "UPDATE users SET storage_quota_mb = $1 WHERE id = $2 RETURNING id, storage_quota_mb, storage_used_mb",
      [storage_quota_mb, id]
    );
    if (!result.rows[0]) return reply.status(404).send({ ok: false, error: "Пользователь не найден" });
    return reply.send({ ok: true, data: result.rows[0] });
  });

  // ─── Credit prices ────────────────────────────────────────────────────────

  // GET /api/admin/credit-prices
  app.get("/api/admin/credit-prices", async (_req, reply) => {
    const result = await dbQuery("SELECT operation, credits, markup_percent FROM credit_prices ORDER BY operation");
    return reply.send({ ok: true, data: result.rows });
  });

  // PUT /api/admin/credit-prices/:operation
  app.put("/api/admin/credit-prices/:operation", async (req, reply) => {
    const { operation } = req.params as { operation: string };
    const parsed = AdminUpdateCreditPriceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
    }
    const { credits, markup_percent = 0 } = parsed.data;
    await dbQuery(
      `INSERT INTO credit_prices (operation, credits, markup_percent) VALUES ($1, $2, $3)
       ON CONFLICT (operation) DO UPDATE SET credits = $2, markup_percent = $3`,
      [operation, credits, markup_percent]
    );
    return reply.send({ ok: true, data: { operation, credits, markup_percent } });
  });

  // POST /api/admin/credit-prices — создать новую строку цены (для модель-специфичных операций)
  app.post("/api/admin/credit-prices", async (req, reply) => {
    const body = req.body as { operation?: string; credits?: number; markup_percent?: number };
    const operation = body?.operation?.trim();
    if (!operation) {
      return reply.status(400).send({ ok: false, error: "operation обязателен" });
    }
    const credits = Number(body?.credits ?? 0);
    const markup_percent = Number(body?.markup_percent ?? 0);
    await dbQuery(
      `INSERT INTO credit_prices (operation, credits, markup_percent) VALUES ($1, $2, $3)
       ON CONFLICT (operation) DO UPDATE SET credits = $2, markup_percent = $3`,
      [operation, credits, markup_percent]
    );
    return reply.send({ ok: true, data: { operation, credits, markup_percent } });
  });

  // DELETE /api/admin/credit-prices/:operation — удалить модель-специфичную строку
  const DEFAULT_OPERATIONS = new Set([
    "chat_claude", "chat_chatgpt", "chat_gemini",
    "image_generate", "video_generate", "prompt_improve",
  ]);
  app.delete("/api/admin/credit-prices/:operation", async (req, reply) => {
    const { operation } = req.params as { operation: string };
    if (DEFAULT_OPERATIONS.has(operation)) {
      return reply.status(400).send({ ok: false, error: "Нельзя удалить базовую операцию" });
    }
    const result = await dbQuery("DELETE FROM credit_prices WHERE operation = $1", [operation]);
    if ((result.rowCount ?? 0) === 0) {
      return reply.status(404).send({ ok: false, error: "Строка не найдена" });
    }
    return reply.send({ ok: true });
  });

  // ─── Transactions ─────────────────────────────────────────────────────────

  // GET /api/admin/transactions?limit=50&offset=0&user_id=...
  app.get("/api/admin/transactions", async (req, reply) => {
    const query = req.query as Record<string, string>;
    const limit = Math.min(Number(query.limit ?? 50), 200);
    const offset = Number(query.offset ?? 0);
    const userId = query.user_id;

    const whereParts: string[] = [];
    const params: unknown[] = [];
    if (userId) {
      whereParts.push(`ct.user_id = $${params.length + 1}`);
      params.push(userId);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    params.push(limit, offset);

    const result = await dbQuery(
      `SELECT ct.id, ct.user_id, u.email, u.name, ct.amount, ct.type, ct.operation, ct.description, ct.created_at
       FROM credit_transactions ct
       JOIN users u ON u.id = ct.user_id
       ${where}
       ORDER BY ct.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const total = await dbQuery(
      `SELECT COUNT(*) as count FROM credit_transactions ct ${where}`,
      whereParts.length ? params.slice(0, -2) : []
    );

    return reply.send({ ok: true, data: { items: result.rows, total: Number(total.rows[0].count) } });
  });

  // ─── Stats ────────────────────────────────────────────────────────────────

  // GET /api/admin/stats
  app.get("/api/admin/stats", async (_req, reply) => {
    const [users, chats, files, balances, messages, spent] = await Promise.all([
      dbQuery("SELECT COUNT(*) as count FROM users"),
      dbQuery("SELECT COUNT(*) as count FROM chats"),
      dbQuery("SELECT COUNT(*) as count FROM files"),
      dbQuery("SELECT COALESCE(SUM(credits_balance), 0) as total FROM users"),
      dbQuery("SELECT COUNT(*) as count FROM chat_messages"),
      dbQuery("SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM credit_transactions WHERE amount < 0"),
    ]);
    return reply.send({
      ok: true,
      data: {
        total_users: Number(users.rows[0].count),
        total_chats: Number(chats.rows[0].count),
        total_files: Number(files.rows[0].count),
        total_credits_balance: Number(balances.rows[0].total),
        total_messages: Number(messages.rows[0].count),
        total_credits_spent: Number(spent.rows[0].total),
      },
    });
  });
}
