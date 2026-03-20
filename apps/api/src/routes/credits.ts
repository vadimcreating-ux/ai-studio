import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";


export async function creditsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // GET /api/credits/balance
  app.get("/api/credits/balance", async (req, reply) => {
    const user = req.authUser!;
    const result = await dbQuery("SELECT credits_balance FROM users WHERE id = $1", [user.userId]);
    return reply.send({ ok: true, data: { credits_balance: result.rows[0]?.credits_balance ?? 0 } });
  });

  // GET /api/credits/history?limit=50&offset=0
  app.get("/api/credits/history", async (req, reply) => {
    const user = req.authUser!;
    const query = req.query as Record<string, string>;
    const limit = Math.min(Number(query.limit ?? 50), 200);
    const offset = Number(query.offset ?? 0);

    const [rows, total] = await Promise.all([
      dbQuery(
        "SELECT id, amount, type, operation, description, created_at FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        [user.userId, limit, offset]
      ),
      dbQuery("SELECT COUNT(*) as count FROM credit_transactions WHERE user_id = $1", [user.userId]),
    ]);

    return reply.send({ ok: true, data: { items: rows.rows, total: Number(total.rows[0].count) } });
  });

  // GET /api/credits/prices — public list of operation costs (with markup applied)
  app.get("/api/credits/prices", async (_req, reply) => {
    const result = await dbQuery("SELECT operation, credits, markup_percent FROM credit_prices ORDER BY operation");
    const data = result.rows.map((r: any) => ({
      operation: r.operation,
      credits: Math.round(Number(r.credits) * (1 + Number(r.markup_percent ?? 0) / 100) * 10000) / 10000,
    }));
    return reply.send({ ok: true, data });
  });
}
