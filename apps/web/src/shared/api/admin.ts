import { api } from "./client";
import type { User } from "./auth";
import type { CreditTransaction, CreditPrice } from "./credits";

export type AdminStats = {
  total_users: number;
  total_chats: number;
  total_files: number;
  total_credits_balance: number;
  total_messages: number;
  total_credits_spent: number;
};

export const adminApi = {
  stats: () =>
    api.get<{ ok: boolean; data: AdminStats }>("/api/admin/stats"),

  users: () =>
    api.get<{ ok: boolean; data: User[] }>("/api/admin/users"),

  createUser: (data: { email: string; password: string; name: string; role: "admin" | "user"; credits_balance?: number }) =>
    api.post<{ ok: boolean; data: User }>("/api/admin/users", data),

  updateUser: (id: string, data: Partial<Pick<User, "name" | "role" | "is_active" | "credits_balance">>) =>
    api.patch<{ ok: boolean; data: User }>(`/api/admin/users/${id}`, data),

  deleteUser: (id: string) =>
    api.delete<{ ok: boolean; data: null }>(`/api/admin/users/${id}`),

  resetPassword: (id: string, new_password: string) =>
    api.patch<{ ok: boolean; data: null }>(`/api/admin/users/${id}/password`, { new_password }),

  addCredits: (userId: string, amount: number, description?: string) =>
    api.post<{ ok: boolean; data: { credits_balance: number } }>(
      `/api/admin/users/${userId}/credits`,
      { amount, description }
    ),

  updateStorage: (userId: string, storage_quota_mb: number) =>
    api.patch<{ ok: boolean; data: { id: string; storage_quota_mb: number; storage_used_mb: number } }>(
      `/api/admin/users/${userId}/storage`,
      { storage_quota_mb }
    ),

  transactions: (params?: { limit?: number; offset?: number; user_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    if (params?.user_id) q.set("user_id", params.user_id);
    return api.get<{ ok: boolean; data: { items: (CreditTransaction & { email: string; name: string })[]; total: number } }>(
      `/api/admin/transactions?${q.toString()}`
    );
  },

  creditPrices: () =>
    api.get<{ ok: boolean; data: CreditPrice[] }>("/api/admin/credit-prices"),

  updateCreditPrice: (operation: string, credits: number, markup_percent?: number) =>
    api.put<{ ok: boolean; data: CreditPrice }>(`/api/admin/credit-prices/${operation}`, { credits, markup_percent }),

  createCreditPrice: (operation: string, credits: number, markup_percent?: number) =>
    api.post<{ ok: boolean; data: CreditPrice }>("/api/admin/credit-prices", { operation, credits, markup_percent }),

  deleteCreditPrice: (operation: string) =>
    api.delete<{ ok: boolean }>(`/api/admin/credit-prices/${operation}`),
};
