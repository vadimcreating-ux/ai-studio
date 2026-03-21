import type { FastifyInstance } from "fastify";
import { dbQuery } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";

const PERIOD_SQL: Record<string, string> = {
  "7d":  "NOW() - INTERVAL '7 days'",
  "30d": "NOW() - INTERVAL '30 days'",
  "all": "NOW() - INTERVAL '100 years'",
};

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
        `SELECT id, amount, type, operation, description,
                kie_amount, markup_percent, group_name, created_at
         FROM credit_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [user.userId, limit, offset]
      ),
      dbQuery("SELECT COUNT(*) as count FROM credit_transactions WHERE user_id = $1", [user.userId]),
    ]);

    return reply.send({ ok: true, data: { items: rows.rows, total: Number(total.rows[0].count) } });
  });

  // GET /api/credits/stats?period=7d|30d|all
  app.get("/api/credits/stats", async (req, reply) => {
    const user = req.authUser!;
    const query = req.query as Record<string, string>;
    const period = (query.period ?? "30d") in PERIOD_SQL ? (query.period ?? "30d") : "30d";
    const since = PERIOD_SQL[period];

    const [groupRows, totalsRow] = await Promise.all([
      dbQuery(
        `SELECT
           group_name,
           SUM(CASE WHEN type = 'spend' THEN ABS(amount) ELSE 0 END)      AS total_spent,
           SUM(CASE WHEN type = 'spend' THEN kie_amount   ELSE 0 END)      AS kie_total,
           SUM(CASE WHEN type = 'spend'
                    THEN ABS(amount) - kie_amount ELSE 0 END)              AS markup_total,
           COUNT(CASE WHEN type = 'spend' THEN 1 END)                      AS tx_count
         FROM credit_transactions
         WHERE user_id = $1
           AND created_at > ${since}
           AND group_name != ''
         GROUP BY group_name
         ORDER BY total_spent DESC`,
        [user.userId]
      ),
      dbQuery(
        `SELECT
           SUM(CASE WHEN type = 'spend'  THEN ABS(amount) ELSE 0 END) AS total_spent,
           SUM(CASE WHEN type = 'refund' THEN amount       ELSE 0 END) AS total_refunded,
           SUM(CASE WHEN type = 'add'    THEN amount       ELSE 0 END) AS total_added,
           COUNT(CASE WHEN type = 'spend' THEN 1 END)                  AS tx_count
         FROM credit_transactions
         WHERE user_id = $1
           AND created_at > ${since}`,
        [user.userId]
      ),
    ]);

    const totals = totalsRow.rows[0] ?? {};
    return reply.send({
      ok: true,
      data: {
        period,
        total_spent:    Number(totals.total_spent    ?? 0),
        total_refunded: Number(totals.total_refunded ?? 0),
        total_added:    Number(totals.total_added    ?? 0),
        tx_count:       Number(totals.tx_count       ?? 0),
        by_group: groupRows.rows.map((r: any) => ({
          group_name:   r.group_name,
          total_spent:  Number(r.total_spent),
          kie_total:    Number(r.kie_total),
          markup_total: Number(r.markup_total),
          tx_count:     Number(r.tx_count),
        })),
      },
    });
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
