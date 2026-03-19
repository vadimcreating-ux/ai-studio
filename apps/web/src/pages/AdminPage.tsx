import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../shared/api/admin";
import { Users, Coins, BarChart3, History, ChevronRight, Plus, Minus } from "lucide-react";

type Tab = "stats" | "users" | "prices" | "transactions";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("stats");
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminApi.stats().then((r) => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.users().then((r) => r.data),
    enabled: tab === "users",
  });

  const { data: prices } = useQuery({
    queryKey: ["admin", "credit-prices"],
    queryFn: () => adminApi.creditPrices().then((r) => r.data),
    enabled: tab === "prices",
  });

  const { data: transactions } = useQuery({
    queryKey: ["admin", "transactions"],
    queryFn: () => adminApi.transactions({ limit: 100 }).then((r) => r.data),
    enabled: tab === "transactions",
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none px-6 pt-6 pb-0">
        <h1 className="text-xl font-semibold text-white mb-4">Панель администратора</h1>
        <div className="flex gap-1 border-b border-border">
          {([
            { id: "stats" as Tab, label: "Статистика", icon: BarChart3 },
            { id: "users" as Tab, label: "Пользователи", icon: Users },
            { id: "prices" as Tab, label: "Цены", icon: Coins },
            { id: "transactions" as Tab, label: "Транзакции", icon: History },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors ${
                tab === id
                  ? "border-accent text-white"
                  : "border-transparent text-muted hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "stats" && stats && <StatsTab stats={stats} />}
        {tab === "users" && <UsersTab users={users ?? []} qc={qc} />}
        {tab === "prices" && <PricesTab prices={prices ?? []} qc={qc} />}
        {tab === "transactions" && <TransactionsTab transactions={transactions?.items ?? []} />}
      </div>
    </div>
  );
}

function StatsTab({ stats }: { stats: { total_users: number; total_chats: number; total_files: number; total_credits_issued: number } }) {
  return (
    <div className="grid grid-cols-2 gap-4 max-w-lg">
      {[
        { label: "Пользователей", value: stats.total_users },
        { label: "Чатов", value: stats.total_chats },
        { label: "Файлов", value: stats.total_files },
        { label: "Кредитов выдано", value: stats.total_credits_issued },
      ].map(({ label, value }) => (
        <div key={label} className="bg-panel border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
          <div className="text-sm text-muted mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}

type UserRow = { id: string; email: string; name: string; role: string; is_active: boolean; credits_balance: number; created_at: string };

function UsersTab({ users, qc }: { users: UserRow[]; qc: ReturnType<typeof useQueryClient> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState<Record<string, string>>({});

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminApi.updateUser(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const addCredits = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      adminApi.addCredits(id, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingId(null);
      setAddAmount({});
    },
  });

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="bg-panel border border-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium truncate">{u.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  u.role === "admin" ? "bg-accent/20 text-accent" : "bg-surface text-muted"
                }`}>
                  {u.role === "admin" ? "admin" : "user"}
                </span>
                {!u.is_active && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">отключён</span>
                )}
              </div>
              <div className="text-sm text-muted truncate">{u.email}</div>
              <div className="text-sm text-white mt-1">
                Кредитов: <span className="font-medium">{u.credits_balance.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                className="flex items-center gap-1 px-2 py-1 bg-surface hover:bg-border rounded text-xs text-muted hover:text-white transition-colors"
              >
                <Coins className="w-3 h-3" />
                Кредиты
              </button>
              <button
                onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  u.is_active
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                }`}
              >
                {u.is_active ? "Отключить" : "Включить"}
              </button>
            </div>
          </div>

          {editingId === u.id && (
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAddAmount((a) => ({ ...a, [u.id]: String(Math.max(0, Number(a[u.id] ?? 0) - 100)) }))}
                  className="p-1 bg-surface hover:bg-border rounded text-muted hover:text-white transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  value={addAmount[u.id] ?? ""}
                  onChange={(e) => setAddAmount((a) => ({ ...a, [u.id]: e.target.value }))}
                  placeholder="Количество"
                  className="w-28 bg-surface border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent text-center"
                />
                <button
                  onClick={() => setAddAmount((a) => ({ ...a, [u.id]: String(Number(a[u.id] ?? 0) + 100) }))}
                  className="p-1 bg-surface hover:bg-border rounded text-muted hover:text-white transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <button
                onClick={() => {
                  const amount = Number(addAmount[u.id]);
                  if (amount > 0) addCredits.mutate({ id: u.id, amount });
                }}
                disabled={!addAmount[u.id] || Number(addAmount[u.id]) <= 0 || addCredits.isPending}
                className="px-3 py-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded text-sm transition-colors"
              >
                {addCredits.isPending ? "..." : "Начислить"}
              </button>
              <span className="text-xs text-muted">кредитов</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type PriceRow = { operation: string; credits: number };
const OPERATION_LABELS: Record<string, string> = {
  chat_claude: "Чат Claude",
  chat_chatgpt: "Чат ChatGPT",
  chat_gemini: "Чат Gemini",
  image_generate: "Генерация изображения",
  video_generate: "Генерация видео",
  prompt_improve: "Улучшение промпта",
};

function PricesTab({ prices, qc }: { prices: PriceRow[]; qc: ReturnType<typeof useQueryClient> }) {
  const [editing, setEditing] = useState<Record<string, string>>({});

  const updatePrice = useMutation({
    mutationFn: ({ operation, credits }: { operation: string; credits: number }) =>
      adminApi.updateCreditPrice(operation, credits),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "credit-prices"] }),
  });

  return (
    <div className="space-y-2 max-w-lg">
      <p className="text-sm text-muted mb-4">
        Количество внутренних кредитов, списываемых за каждую операцию.
      </p>
      {prices.map((p) => (
        <div key={p.operation} className="bg-panel border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-white text-sm font-medium">
              {OPERATION_LABELS[p.operation] ?? p.operation}
            </div>
            <div className="text-xs text-muted mt-0.5 font-mono">{p.operation}</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={editing[p.operation] ?? p.credits}
              onChange={(e) => setEditing((prev) => ({ ...prev, [p.operation]: e.target.value }))}
              className="w-20 bg-surface border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent text-center"
              min="0"
            />
            <button
              onClick={() => {
                const val = Number(editing[p.operation] ?? p.credits);
                updatePrice.mutate({ operation: p.operation, credits: val });
                setEditing((prev) => ({ ...prev, [p.operation]: String(val) }));
              }}
              disabled={
                updatePrice.isPending ||
                Number(editing[p.operation] ?? p.credits) === p.credits
              }
              className="px-3 py-1 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded text-sm transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

type TxRow = { id: string; email: string; name: string; amount: number; type: string; operation: string; description: string; created_at: string };

function TransactionsTab({ transactions }: { transactions: TxRow[] }) {
  return (
    <div className="space-y-2">
      {transactions.length === 0 && (
        <p className="text-muted text-sm">Транзакций пока нет</p>
      )}
      {transactions.map((t) => (
        <div key={t.id} className="bg-panel border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-white truncate">{t.description || t.operation}</div>
            <div className="text-xs text-muted">{t.email} · {new Date(t.created_at).toLocaleString("ru")}</div>
          </div>
          <div className={`text-sm font-medium flex-shrink-0 ${t.amount > 0 ? "text-green-400" : "text-red-400"}`}>
            {t.amount > 0 ? "+" : ""}{t.amount}
          </div>
        </div>
      ))}
    </div>
  );
}
