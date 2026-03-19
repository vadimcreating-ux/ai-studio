import { api } from "./client";
import type { User } from "./auth";
import type { CreditTransaction, CreditPrice } from "./credits";

export type AdminStats = {
  total_users: number;
  total_chats: number;
  total_files: number;
  total_credits_issued: number;
};

export const adminApi = {
  stats: () =>
    api.get<{ ok: boolean; data: AdminStats }>("/api/admin/stats"),

  users: () =>
    api.get<{ ok: boolean; data: User[] }>("/api/admin/users"),

  updateUser: (id: string, data: Partial<Pick<User, "name" | "role" | "is_active" | "credits_balance">>) =>
    api.patch<{ ok: boolean; data: User }>(`/api/admin/users/${id}`, data),

  addCredits: (userId: string, amount: number, description?: string) =>
    api.post<{ ok: boolean; data: { credits_balance: number } }>(
      `/api/admin/users/${userId}/credits`,
      { amount, description }
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

  updateCreditPrice: (operation: string, credits: number) =>
    api.put<{ ok: boolean; data: CreditPrice }>(`/api/admin/credit-prices/${operation}`, { credits }),
};
