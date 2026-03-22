import bcrypt from "bcryptjs";
export const SALT_ROUNDS = 12;
export function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}
export function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
export function setAuthCookie(reply, token) {
    const isDev = process.env.NODE_ENV !== "production";
    reply.setCookie("auth_token", token, {
        httpOnly: true,
        secure: !isDev,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
    });
}
export function clearAuthCookie(reply) {
    reply.clearCookie("auth_token", { path: "/" });
}
export async function authenticate(request, reply) {
    const token = request.cookies?.auth_token;
    if (!token) {
        return reply.status(401).send({ ok: false, error: "Необходима авторизация" });
    }
    try {
        const payload = request.server.jwt.verify(token);
        request.authUser = payload;
    }
    catch {
        return reply.status(401).send({ ok: false, error: "Сессия истекла, войдите снова" });
    }
}
export async function requireAdmin(request, reply) {
    if (request.authUser?.role !== "admin") {
        return reply.status(403).send({ ok: false, error: "Доступ запрещён" });
    }
}
