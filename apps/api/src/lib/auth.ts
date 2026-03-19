import type { FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";

export const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type JwtPayload = {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "user";
};

// We attach our user payload to request under a custom key to avoid collision
// with @fastify/jwt's built-in `user` property typing
declare module "fastify" {
  interface FastifyRequest {
    authUser?: JwtPayload;
  }
}

export function setAuthCookie(reply: FastifyReply, token: string) {
  const isDev = process.env.NODE_ENV !== "production";
  reply.setCookie("auth_token", token, {
    httpOnly: true,
    secure: !isDev,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearAuthCookie(reply: FastifyReply) {
  reply.clearCookie("auth_token", { path: "/" });
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const token = (request.cookies as Record<string, string>)?.auth_token;
  if (!token) {
    return reply.status(401).send({ ok: false, error: "Необходима авторизация" });
  }
  try {
    const payload = request.server.jwt.verify<JwtPayload>(token);
    request.authUser = payload;
  } catch {
    return reply.status(401).send({ ok: false, error: "Сессия истекла, войдите снова" });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.authUser?.role !== "admin") {
    return reply.status(403).send({ ok: false, error: "Доступ запрещён" });
  }
}
