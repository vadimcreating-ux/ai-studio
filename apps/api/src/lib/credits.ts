import { dbQuery } from "./db.js";

/**
 * Atomically deduct credits using a single UPDATE with WHERE balance >= amount.
 * This is race-condition-safe: the check and deduction are one atomic DB operation.
 *
 * Returns the deducted amount on success, or 0 if balance is insufficient.
 */
export async function atomicDeduct(
  userId: string,
  amount: number,
  operation: string,
  description: string
): Promise<number> {
  if (amount <= 0) return 0;

  const rounded = Math.round(amount * 10000) / 10000;

  const result = await dbQuery(
    `UPDATE users
     SET credits_balance = credits_balance - $1
     WHERE id = $2 AND credits_balance >= $1
     RETURNING credits_balance`,
    [rounded, userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    return 0; // Insufficient balance — nothing was changed
  }

  await dbQuery(
    `INSERT INTO credit_transactions (user_id, amount, type, operation, description)
     VALUES ($1, $2, 'spend', $3, $4)`,
    [userId, -rounded, operation, description]
  );

  return rounded;
}

/**
 * Refund credits back to user (always succeeds, no balance check).
 * Use this when a pre-charged operation fails or is cancelled.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  operation: string,
  description: string
): Promise<void> {
  if (amount <= 0) return;

  const rounded = Math.round(amount * 10000) / 10000;

  await dbQuery(
    `UPDATE users SET credits_balance = credits_balance + $1 WHERE id = $2`,
    [rounded, userId]
  );

  await dbQuery(
    `INSERT INTO credit_transactions (user_id, amount, type, operation, description)
     VALUES ($1, $2, 'refund', $3, $4)`,
    [userId, rounded, operation, description]
  );
}

/**
 * Look up charge amount from credit_prices using a priority key list.
 * Returns { credits, markupPercent, chargeAmount, operationKey } or null if not priced.
 */
export async function lookupPrice(keys: string[]): Promise<{
  credits: number;
  markupPercent: number;
  chargeAmount: number;
  operationKey: string;
} | null> {
  for (const key of keys) {
    const res = await dbQuery(
      "SELECT credits, markup_percent FROM credit_prices WHERE operation = $1",
      [key]
    );
    if (res.rows[0] && Number(res.rows[0].credits) > 0) {
      const credits = Number(res.rows[0].credits);
      const markupPercent = Number(res.rows[0].markup_percent ?? 0);
      const chargeAmount = Math.round(credits * (1 + markupPercent / 100) * 10000) / 10000;
      return { credits, markupPercent, chargeAmount, operationKey: key };
    }
  }
  return null;
}

/**
 * Non-atomic balance read — use only for UX display, not for gating access.
 */
export async function getBalance(userId: string): Promise<number> {
  const result = await dbQuery(
    "SELECT credits_balance FROM users WHERE id = $1",
    [userId]
  );
  return Number(result.rows[0]?.credits_balance ?? 0);
}
