import { dbQuery } from "./db.js";
export function operationToGroup(operation) {
    if (operation.startsWith("chat_"))
        return "Чаты";
    if (operation.startsWith("image_"))
        return "Изображения";
    if (operation.startsWith("video_"))
        return "Видео";
    if (operation === "prompt_improve")
        return "Улучшения";
    return "Прочее";
}
/**
 * Atomically deduct credits using a single UPDATE with WHERE balance >= amount.
 * This is race-condition-safe: the check and deduction are one atomic DB operation.
 *
 * Returns the deducted amount on success, or 0 if balance is insufficient.
 */
export async function atomicDeduct(userId, amount, operation, description, extra) {
    if (amount <= 0)
        return 0;
    const rounded = Math.round(amount * 10000) / 10000;
    const kieAmount = Math.round((extra?.kieAmount ?? 0) * 10000) / 10000;
    const markupPercent = extra?.markupPercent ?? 0;
    const groupName = operationToGroup(operation);
    const result = await dbQuery(`UPDATE users
     SET credits_balance = credits_balance - $1
     WHERE id = $2 AND credits_balance >= $1
     RETURNING credits_balance`, [rounded, userId]);
    if ((result.rowCount ?? 0) === 0) {
        return 0; // Insufficient balance — nothing was changed
    }
    await dbQuery(`INSERT INTO credit_transactions
       (user_id, amount, type, operation, description, kie_amount, markup_percent, group_name)
     VALUES ($1, $2, 'spend', $3, $4, $5, $6, $7)`, [userId, -rounded, operation, description, kieAmount, markupPercent, groupName]);
    return rounded;
}
/**
 * Refund credits back to user (always succeeds, no balance check).
 */
export async function refundCredits(userId, amount, operation, description) {
    if (amount <= 0)
        return;
    const rounded = Math.round(amount * 10000) / 10000;
    const groupName = operationToGroup(operation);
    await dbQuery(`UPDATE users SET credits_balance = credits_balance + $1 WHERE id = $2`, [rounded, userId]);
    await dbQuery(`INSERT INTO credit_transactions
       (user_id, amount, type, operation, description, kie_amount, markup_percent, group_name)
     VALUES ($1, $2, 'refund', $3, $4, 0, 0, $5)`, [userId, rounded, operation, description, groupName]);
}
/**
 * Look up charge amount from credit_prices using a priority key list.
 * Returns { credits, markupPercent, chargeAmount, operationKey } or null if not priced.
 */
export async function lookupPrice(keys) {
    for (const key of keys) {
        const res = await dbQuery("SELECT credits, markup_percent FROM credit_prices WHERE operation = $1", [key]);
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
 * Spend KIE credits × markup after a successful KIE response.
 * Tries atomic deduction first; if balance ran out in the race window,
 * force-deducts (creates at most one request worth of debt).
 */
export async function spendCredits(userId, kieAmount, operation) {
    if (kieAmount <= 0)
        return 0;
    let markupPercent = 0;
    try {
        const priceRes = await dbQuery("SELECT markup_percent FROM credit_prices WHERE operation = $1", [operation]);
        markupPercent = Number(priceRes.rows[0]?.markup_percent ?? 0);
    }
    catch { /* column might not exist yet */ }
    const amount = Math.round(kieAmount * (1 + markupPercent / 100) * 10000) / 10000;
    const deducted = await atomicDeduct(userId, amount, operation, `Запрос к ${operation}`, { kieAmount, markupPercent });
    if (deducted > 0)
        return deducted;
    // Balance went to zero in the race window — force-deduct.
    const groupName = operationToGroup(operation);
    await dbQuery("UPDATE users SET credits_balance = credits_balance - $1 WHERE id = $2", [amount, userId]);
    await dbQuery(`INSERT INTO credit_transactions
       (user_id, amount, type, operation, description, kie_amount, markup_percent, group_name)
     VALUES ($1, $2, 'spend', $3, $4, $5, $6, $7)`, [userId, -amount, operation, `Запрос к ${operation} (принудительно)`, kieAmount, markupPercent, groupName]);
    return amount;
}
/**
 * Non-atomic balance read — use only for UX display, not for gating access.
 */
export async function getBalance(userId) {
    const result = await dbQuery("SELECT credits_balance FROM users WHERE id = $1", [userId]);
    return Number(result.rows[0]?.credits_balance ?? 0);
}
