import { randomUUID } from "node:crypto";
import { dbQuery } from "./db.js";
import { uploadToS3, deleteFromS3, isS3Configured } from "./s3.js";
function mapRowToFileItem(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        type: row.type,
        name: row.name,
        url: row.storage_url ?? row.url,
        createdAt: row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
        source: row.source,
        prompt: row.prompt ?? null,
        fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : null,
        creditsSpent: row.credits_spent != null ? Number(row.credits_spent) : null,
    };
}
// Check if user has enough quota. Returns remaining bytes, or throws if exceeded.
export async function checkStorageQuota(userId, neededBytes) {
    const result = await dbQuery("SELECT storage_quota_mb, storage_used_mb FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];
    if (!user)
        return;
    const quotaBytes = Number(user.storage_quota_mb) * 1024 * 1024;
    const usedBytes = Number(user.storage_used_mb) * 1024 * 1024;
    if (usedBytes + neededBytes > quotaBytes) {
        const remainingMb = ((quotaBytes - usedBytes) / 1024 / 1024).toFixed(1);
        throw new Error(`Недостаточно места в хранилище. Осталось ${remainingMb} MB из ${user.storage_quota_mb} MB. Удалите старые файлы или обратитесь к администратору.`);
    }
}
// Download file from URL, upload to S3, return { buffer, storageUrl, s3Key, fileSizeBytes }
async function downloadAndUpload(sourceUrl, s3Key, contentType) {
    const response = await fetch(sourceUrl);
    if (!response.ok)
        throw new Error(`Не удалось скачать файл: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const storageUrl = await uploadToS3(buffer, s3Key, contentType);
    return { storageUrl, s3Key, fileSizeBytes: buffer.byteLength };
}
export async function saveFileToStorage(data) {
    // Return existing record if already saved
    const existing = await dbQuery(`SELECT id, task_id, type, name, url, storage_url, created_at, source, prompt, file_size_bytes, credits_spent
     FROM files WHERE task_id = $1 LIMIT 1`, [data.taskId]);
    if (existing.rows[0])
        return mapRowToFileItem(existing.rows[0]);
    const id = randomUUID();
    const ext = data.type === "video" ? "mp4" : "png";
    const name = `${data.type}-${Date.now()}.${ext}`;
    const contentType = data.type === "video" ? "video/mp4" : "image/png";
    const s3Key = `generated/${data.userId ?? "anon"}/${data.type}s/${id}.${ext}`;
    let storageUrl = null;
    let s3KeySaved = null;
    let fileSizeBytes = null;
    if (isS3Configured()) {
        try {
            // Check quota before downloading (estimate 5MB image / 100MB video if unknown)
            const estimatedSize = data.type === "video" ? 100 * 1024 * 1024 : 5 * 1024 * 1024;
            if (data.userId)
                await checkStorageQuota(data.userId, estimatedSize);
            const result = await downloadAndUpload(data.url, s3Key, contentType);
            storageUrl = result.storageUrl;
            s3KeySaved = result.s3Key;
            fileSizeBytes = result.fileSizeBytes;
            // Re-check with real size (in case estimate was off)
            if (data.userId && fileSizeBytes > estimatedSize) {
                await checkStorageQuota(data.userId, fileSizeBytes - estimatedSize);
            }
        }
        catch (err) {
            // If quota exceeded, re-throw
            if (err.message?.includes("хранилище"))
                throw err;
            // S3 upload failed — fall back to KIE URL
            console.error("S3 upload failed, falling back to KIE URL:", err.message);
        }
    }
    const inserted = await dbQuery(`INSERT INTO files (id, task_id, type, name, url, storage_url, s3_key, file_size_bytes, created_at, source, prompt, user_id, credits_spent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12)
     ON CONFLICT (task_id) DO NOTHING
     RETURNING id, task_id, type, name, url, storage_url, s3_key, file_size_bytes, created_at, source, prompt, credits_spent`, [id, data.taskId, data.type, name, data.url, storageUrl, s3KeySaved, fileSizeBytes, "kie", data.prompt || null, data.userId || null, data.creditsSpent ?? null]);
    // Update user storage_used_mb
    if (data.userId && fileSizeBytes) {
        const mbUsed = fileSizeBytes / 1024 / 1024;
        await dbQuery("UPDATE users SET storage_used_mb = storage_used_mb + $1 WHERE id = $2", [mbUsed, data.userId]);
    }
    if (inserted.rows[0])
        return mapRowToFileItem(inserted.rows[0]);
    const fallback = await dbQuery(`SELECT id, task_id, type, name, url, storage_url, created_at, source, prompt, file_size_bytes, credits_spent
     FROM files WHERE task_id = $1 LIMIT 1`, [data.taskId]);
    return mapRowToFileItem(fallback.rows[0]);
}
// Legacy alias for image
export async function saveImageToFiles(data) {
    return saveFileToStorage({ ...data, type: "image" });
}
// Legacy alias for video
export async function saveVideoToFiles(data) {
    await saveFileToStorage({ ...data, type: "video" });
}
export async function getFiles(limit = 50, offset = 0, userId) {
    const where = userId ? "WHERE user_id = $1" : "";
    const countParams = userId ? [userId] : [];
    const listParams = userId ? [userId, limit, offset] : [limit, offset];
    const limitIdx = userId ? "$2" : "$1";
    const offsetIdx = userId ? "$3" : "$2";
    const [result, countResult] = await Promise.all([
        dbQuery(`SELECT id, task_id, type, name, url, storage_url, created_at, source, prompt, file_size_bytes, credits_spent
       FROM files ${where} ORDER BY created_at DESC LIMIT ${limitIdx} OFFSET ${offsetIdx}`, listParams),
        dbQuery(`SELECT COUNT(*) FROM files ${where}`, countParams),
    ]);
    return {
        files: result.rows.map(mapRowToFileItem),
        total: parseInt(countResult.rows[0].count, 10),
    };
}
export async function deleteFileById(id, userId) {
    // Fetch s3_key and file_size_bytes before deleting
    const selectResult = await dbQuery(`SELECT s3_key, file_size_bytes, user_id FROM files WHERE id = $1`, [id]);
    const row = selectResult.rows[0];
    if (!row)
        return false;
    const result = await dbQuery(`DELETE FROM files WHERE id = $1`, [id]);
    if ((result.rowCount ?? 0) === 0)
        return false;
    // Delete from S3 if has key
    if (row.s3_key && isS3Configured()) {
        deleteFromS3(row.s3_key).catch((err) => console.error("S3 delete failed:", err.message));
    }
    // Decrement user's storage_used_mb
    const ownerId = userId ?? row.user_id;
    if (ownerId && row.file_size_bytes) {
        const mbUsed = Number(row.file_size_bytes) / 1024 / 1024;
        await dbQuery("UPDATE users SET storage_used_mb = GREATEST(0, storage_used_mb - $1) WHERE id = $2", [mbUsed, ownerId]);
    }
    return true;
}
