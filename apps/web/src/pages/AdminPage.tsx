import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../shared/api/admin";
import { Users, Coins, BarChart3, History, ChevronRight, Plus, Minus, HardDrive } from "lucide-react";

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

type UserRow = {
  id: string; email: string; name: string; role: string; is_active: boolean;
  credits_balance: number; storage_quota_mb: number; storage_used_mb: number; created_at: string;
};

type EditMode = "credits" | "storage" | null;

function StorageBar({ used, quota }: { used: number; quota: number }) {
  const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-accent";
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-xs text-muted mb-1">
        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> Хранилище</span>
        <span>{used.toFixed(1)} / {quota} MB</span>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function UsersTab({ users, qc }: { users: UserRow[]; qc: ReturnType<typeof useQueryClient> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [addAmount, setAddAmount] = useState<Record<string, string>>({});
  const [quotaInput, setQuotaInput] = useState<Record<string, string>>({});

  function openEdit(id: string, mode: EditMode) {
    if (editingId === id && editMode === mode) {
      setEditingId(null);
      setEditMode(null);
    } else {
      setEditingId(id);
      setEditMode(mode);
    }
  }

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

  const updateStorage = useMutation({
    mutationFn: ({ id, storage_quota_mb }: { id: string; storage_quota_mb: number }) =>
      adminApi.updateStorage(id, storage_quota_mb),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingId(null);
      setQuotaInput({});
    },
  });

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="bg-panel border border-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
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
              <StorageBar used={Number(u.storage_used_mb ?? 0)} quota={u.storage_quota_mb ?? 500} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => openEdit(u.id, "credits")}
                className="flex items-center gap-1 px-2 py-1 bg-surface hover:bg-border rounded text-xs text-muted hover:text-white transition-colors"
              >
                <Coins className="w-3 h-3" />
                Кредиты
              </button>
              <button
                onClick={() => openEdit(u.id, "storage")}
                className="flex items-center gap-1 px-2 py-1 bg-surface hover:bg-border rounded text-xs text-muted hover:text-white transition-colors"
              >
                <HardDrive className="w-3 h-3" />
                Диск
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

          {editingId === u.id && editMode === "credits" && (
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

          {editingId === u.id && editMode === "storage" && (
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-muted flex-shrink-0" />
              <span className="text-xs text-muted">Квота (MB):</span>
              <input
                type="number"
                value={quotaInput[u.id] ?? u.storage_quota_mb}
                onChange={(e) => setQuotaInput((q) => ({ ...q, [u.id]: e.target.value }))}
                className="w-24 bg-surface border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent text-center"
                min="0"
                step="100"
              />
              <button
                onClick={() => {
                  const mb = Number(quotaInput[u.id]);
                  if (mb >= 0) updateStorage.mutate({ id: u.id, storage_quota_mb: mb });
                }}
                disabled={updateStorage.isPending}
                className="px-3 py-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded text-sm transition-colors"
              >
                {updateStorage.isPending ? "..." : "Сохранить"}
              </button>
              <span className="text-xs text-muted">
                Сейчас: {Number(u.storage_used_mb ?? 0).toFixed(1)} MB занято
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type PriceRow = { operation: string; credits: number; markup_percent: number };
const OPERATION_LABELS: Record<string, string> = {
  chat_claude: "Чат Claude",
  chat_chatgpt: "Чат ChatGPT",
  chat_gemini: "Чат Gemini",
  image_generate: "Генерация изображения",
  video_generate: "Генерация видео",
  prompt_improve: "Улучшение промпта",
};

function PricesTab({ prices, qc }: { prices: PriceRow[]; qc: ReturnType<typeof useQueryClient> }) {
  const [editingCredits, setEditingCredits] = useState<Record<string, string>>({});
  const [editingMarkup, setEditingMarkup] = useState<Record<string, string>>({});

  const updatePrice = useMutation({
    mutationFn: ({ operation, credits, markup_percent }: { operation: string; credits: number; markup_percent: number }) =>
      adminApi.updateCreditPrice(operation, credits, markup_percent),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "credit-prices"] }),
  });

  return (
    <div className="space-y-2 max-w-xl">
      <p className="text-sm text-muted mb-4">
        Наценка применяется к фактической стоимости, которую вернул KIE. Например: KIE списал 1 кредит, наценка 10% → списывается 1.1 кредита.
      </p>
      {prices.map((p) => {
        const credits = Number(editingCredits[p.operation] ?? p.credits);
        const markup = Number(editingMarkup[p.operation] ?? p.markup_percent);
        const unchanged = credits === p.credits && markup === p.markup_percent;
        return (
          <div key={p.operation} className="bg-panel border border-border rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-white text-sm font-medium">
                  {OPERATION_LABELS[p.operation] ?? p.operation}
                </div>
                <div className="text-xs text-muted mt-0.5 font-mono">{p.operation}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs text-muted">Наценка %</span>
                  <input
                    type="number"
                    value={editingMarkup[p.operation] ?? p.markup_percent}
                    onChange={(e) => setEditingMarkup((prev) => ({ ...prev, [p.operation]: e.target.value }))}
                    className="w-20 bg-surface border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent text-center"
                    min="0"
                    max="1000"
                    step="0.1"
                  />
                </div>
                <button
                  onClick={() => {
                    updatePrice.mutate({ operation: p.operation, credits, markup_percent: markup });
                    setEditingCredits((prev) => ({ ...prev, [p.operation]: String(credits) }));
                    setEditingMarkup((prev) => ({ ...prev, [p.operation]: String(markup) }));
                  }}
                  disabled={updatePrice.isPending || unchanged}
                  className="px-3 py-1 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded text-sm transition-colors self-end mb-0.5"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {p.markup_percent > 0 && (
              <div className="mt-2 text-xs text-muted">
                KIE вернёт X → спишется X × {(1 + p.markup_percent / 100).toFixed(3)}
              </div>
            )}
          </div>
        );
      })}
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
