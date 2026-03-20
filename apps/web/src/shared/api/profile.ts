import { api } from "./client";
import type { User } from "./auth";

export const profileApi = {
  update: (data: { name?: string; avatar_url?: string | null }) =>
    api.patch<{ ok: boolean; data: User }>("/api/auth/profile", data),

  changePassword: (data: { current_password: string; new_password: string }) =>
    api.patch<{ ok: boolean; data: null }>("/api/auth/password", data),

  logoutAll: () =>
    api.post<{ ok: boolean; data: null }>("/api/auth/logout-all", {}),
};
