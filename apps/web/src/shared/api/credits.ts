import { api } from "./client";

export type CreditTransaction = {
  id: string;
  amount: number;
  type: string;
  operation: string;
  description: string;
  kie_amount: number;
  markup_percent: number;
  group_name: string;
  created_at: string;
};

export type CreditPrice = {
  operation: string;
  credits: number;
  markup_percent: number;
};

export type CreditStatGroup = {
  group_name: string;
  total_spent: number;
  kie_total: number;
  markup_total: number;
  tx_count: number;
};

export type CreditStats = {
  period: string;
  total_spent: number;
  total_refunded: number;
  total_added: number;
  tx_count: number;
  by_group: CreditStatGroup[];
};

export const creditsApi = {
  balance: () =>
    api.get<{ ok: boolean; data: { credits_balance: number } }>("/api/credits/balance"),

  history: (limit = 50, offset = 0) =>
    api.get<{ ok: boolean; data: { items: CreditTransaction[]; total: number } }>(
      `/api/credits/history?limit=${limit}&offset=${offset}`
    ),

  stats: (period: "7d" | "30d" | "all" = "30d") =>
    api.get<{ ok: boolean; data: CreditStats }>(
      `/api/credits/stats?period=${period}`
    ),

  prices: () =>
    api.get<{ ok: boolean; data: CreditPrice[] }>("/api/credits/prices"),
};
