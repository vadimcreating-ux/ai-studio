import { api } from "./client";

export type CreditTransaction = {
  id: string;
  amount: number;
  type: string;
  operation: string;
  description: string;
  created_at: string;
};

export type CreditPrice = {
  operation: string;
  credits: number;
};

export const creditsApi = {
  balance: () =>
    api.get<{ ok: boolean; data: { credits_balance: number } }>("/api/credits/balance"),

  history: (limit = 50, offset = 0) =>
    api.get<{ ok: boolean; data: { items: CreditTransaction[]; total: number } }>(
      `/api/credits/history?limit=${limit}&offset=${offset}`
    ),

  prices: () =>
    api.get<{ ok: boolean; data: CreditPrice[] }>("/api/credits/prices"),
};
