import { api } from "./client";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  is_active: boolean;
  credits_balance: number;
  storage_quota_mb: number;
  storage_used_mb: number;
  created_at: string;
};

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ ok: boolean; data: User }>("/api/auth/register", data),

  login: (data: { email: string; password: string }) =>
    api.post<{ ok: boolean; data: User }>("/api/auth/login", data),

  logout: () =>
    api.post<{ ok: boolean; data: null }>("/api/auth/logout", {}),

  me: () =>
    api.get<{ ok: boolean; data: User }>("/api/auth/me"),

  googleLoginUrl: () => "/api/auth/google",
};
