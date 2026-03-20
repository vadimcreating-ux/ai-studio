import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Coins, BarChart3, History, ChevronRight, Plus, Minus, HardDrive,
  Search, UserPlus, Trash2, ShieldCheck, ShieldOff, KeyRound, X,
  MessageSquare, TrendingDown, CheckCircle, AlertCircle, Eye, EyeOff,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { adminApi } from "../shared/api/admin";

type Tab = "stats" | "users" | "prices" | "transactions";

// ── Utility ──────────────────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color: "blue" | "gray" | "red" | "green" }) {
  const cls = {
    blue: "bg-accent/20 text-accent",
    gray: "bg-surface text-muted",
    red: "bg-red-500/20 text-red-400",
    green: "bg-green-500/20 text-green-400",
  }[color];
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{children}</span>;
}

function Toast({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
      {type === "success" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {msg}
    </div>
  );
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────

type StatsData = {
  total_users: number; total_chats: number; total_files: number;
  total_credits_balance: number; total_messages: number; total_credits_spent: number;
};

function StatsTab({ stats }: { stats: StatsData }) {
  const tiles = [
    { label: "Пользователей",    value: stats.total_users.toLocaleString(),                        icon: <Users size={18} className="text-accent" /> },
    { label: "Чатов",             value: stats.total_chats.toLocaleString(),                        icon: <MessageSquare size={18} className="text-blue-400" /> },
    { label: "Сообщений",         value: stats.total_messages.toLocaleString(),                     icon: <BarChart3 size={18} className="text-purple-400" /> },
    { label: "Файлов",            value: stats.total_files.toLocaleString(),                        icon: <HardDrive size={18} className="text-yellow-400" /> },
    { label: "Баланс кредитов",   value: Number(stats.total_credits_balance).toLocaleString("ru", { maximumFractionDigits: 0 }), icon: <Coins size={18} className="text-green-400" /> },
    { label: "Кредитов потрачено",value: Number(stats.total_credits_spent).toLocaleString("ru", { maximumFractionDigits: 2 }), icon: <TrendingDown size={18} className="text-red-400" /> },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
      {tiles.map(({ label, value, icon }) => (
        <div key={label} className="bg-panel border border-border rounded-xl p-4 flex items-start gap-3">
          <div className="mt-0.5">{icon}</div>
          <div>
            <div className="text-2xl font-bold text-white leading-none">{value}</div>
            <div className="text-xs text-muted mt-1">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Create User Modal ─────────────────────────────────────────────────────────

function CreateUserModal({ onClose, qc }: { onClose: () => void; qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "user" as "admin" | "user", credits: "0" });
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () => adminApi.createUser({
      email: form.email,
      name: form.name,
      password: form.password,
      role: form.role,
      credits_balance: Number(form.credits) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      onClose();
    },
    onError: (e: Error) => setStatus({ type: "error", msg: e.message }),
  });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-panel border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <UserPlus size={16} className="text-accent" />
            Создать пользователя
          </h2>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set("email")} required
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
                placeholder="user@example.com" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1.5">Имя</label>
              <input type="text" value={form.name} onChange={set("name")} required maxLength={100}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
                placeholder="Иван Иванов" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1.5">Пароль</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} required minLength={8}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
                  placeholder="Минимум 8 символов" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">Роль</label>
              <select value={form.role} onChange={set("role")}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent">
                <option value="user">Пользователь</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">Стартовые кредиты</label>
              <input type="number" value={form.credits} onChange={set("credits")} min="0"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
          </div>

          {form.role === "admin" && (
            <div className="flex items-start gap-2 px-3 py-2 bg-accent/10 border border-accent/20 rounded-lg">
              <ShieldCheck size={14} className="text-accent mt-0.5 flex-shrink-0" />
              <p className="text-xs text-accent">Администратор получит полный доступ к панели управления, пользователям и настройкам.</p>
            </div>
          )}

          {status && <Toast type={status.type} msg={status.msg} />}

          <div className="flex items-center gap-2 pt-1">
            <button type="submit" disabled={mutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50">
              <UserPlus size={14} />
              {mutation.isPending ? "Создание..." : "Создать"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-surface hover:bg-border rounded-lg text-sm text-muted transition-colors">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reset Password Modal ──────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose, qc }: { user: UserRow; onClose: () => void; qc: ReturnType<typeof useQueryClient> }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () => adminApi.resetPassword(user.id, pw),
    onSuccess: () => {
      setStatus({ type: "success", msg: "Пароль сброшен. Все сессии пользователя завершены." });
      setTimeout(onClose, 2000);
    },
    onError: (e: Error) => setStatus({ type: "error", msg: e.message }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-panel border border-border rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <KeyRound size={16} className="text-accent" />
            Сброс пароля
          </h2>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted">Новый пароль для <span className="text-white font-medium">{user.name}</span> ({user.email})</p>
          <div className="relative">
            <input type={show ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
              placeholder="Минимум 8 символов" minLength={8} />
            <button type="button" onClick={() => setShow(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {status && <Toast type={status.type} msg={status.msg} />}
          <div className="flex items-center gap-2">
            <button onClick={() => mutation.mutate()} disabled={pw.length < 8 || mutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50">
              <KeyRound size={14} />
              {mutation.isPending ? "Сохранение..." : "Сбросить пароль"}
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-surface hover:bg-border rounded-lg text-sm text-muted transition-colors">
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

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
        <span>{Number(used).toFixed(1)} / {quota} MB</span>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function UsersTab({ users, qc }: { users: UserRow[]; qc: ReturnType<typeof useQueryClient> }) {
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [addAmount, setAddAmount] = useState<Record<string, string>>({});
  const [quotaInput, setQuotaInput] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  function openEdit(id: string, mode: EditMode) {
    if (editingId === id && editMode === mode) { setEditingId(null); setEditMode(null); }
    else { setEditingId(id); setEditMode(mode); }
  }

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminApi.updateUser(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const toggleRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "admin" | "user" }) => adminApi.updateUser(id, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const addCredits = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => adminApi.addCredits(id, amount),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); setEditingId(null); setAddAmount({}); },
  });

  const updateStorage = useMutation({
    mutationFn: ({ id, storage_quota_mb }: { id: string; storage_quota_mb: number }) => adminApi.updateStorage(id, storage_quota_mb),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); setEditingId(null); setQuotaInput({}); },
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); qc.invalidateQueries({ queryKey: ["admin", "stats"] }); setConfirmDelete(null); },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm text-white font-medium transition-colors"
        >
          <UserPlus size={14} />
          Добавить
        </button>
      </div>

      {/* User cards */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-muted text-sm py-4">Пользователи не найдены</p>
        )}
        {filtered.map((u) => (
          <div key={u.id} className="bg-panel border border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium truncate">{u.name}</span>
                  <Badge color={u.role === "admin" ? "blue" : "gray"}>
                    {u.role === "admin" ? "admin" : "user"}
                  </Badge>
                  {!u.is_active && <Badge color="red">отключён</Badge>}
                  {u.id === me?.id && <Badge color="green">вы</Badge>}
                </div>
                <div className="text-sm text-muted truncate mt-0.5">{u.email}</div>
                <div className="text-sm text-white mt-1">
                  <Coins size={12} className="inline mr-1 text-accent" />
                  <span className="font-medium">{Number(u.credits_balance).toLocaleString()}</span>
                  <span className="text-muted text-xs ml-1">кр.</span>
                </div>
                <StorageBar used={Number(u.storage_used_mb ?? 0)} quota={u.storage_quota_mb ?? 500} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
                <button onClick={() => openEdit(u.id, "credits")}
                  className="flex items-center gap-1 px-2 py-1 bg-surface hover:bg-border rounded text-xs text-muted hover:text-white transition-colors">
                  <Coins className="w-3 h-3" /> Кредиты
                </button>
                <button onClick={() => openEdit(u.id, "storage")}
                  className="flex items-center gap-1 px-2 py-1 bg-surface hover:bg-border rounded text-xs text-muted hover:text-white transition-colors">
                  <HardDrive className="w-3 h-3" /> Диск
                </button>
                <button onClick={() => setResetUser(u)}
                  className="flex items-center gap-1 px-2 py-1 bg-surface hover:bg-border rounded text-xs text-muted hover:text-white transition-colors">
                  <KeyRound className="w-3 h-3" /> Пароль
                </button>

                {u.id !== me?.id && (
                  <>
                    <button
                      onClick={() => toggleRole.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}
                      disabled={toggleRole.isPending}
                      title={u.role === "admin" ? "Убрать права администратора" : "Сделать администратором"}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors disabled:opacity-50 ${
                        u.role === "admin"
                          ? "bg-accent/20 text-accent hover:bg-accent/30"
                          : "bg-surface hover:bg-border text-muted hover:text-white"
                      }`}
                    >
                      {u.role === "admin" ? <ShieldOff className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                      {u.role === "admin" ? "Разжаловать" : "В админы"}
                    </button>
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                      disabled={toggleActive.isPending}
                      className={`px-2 py-1 rounded text-xs transition-colors disabled:opacity-50 ${
                        u.is_active ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      }`}
                    >
                      {u.is_active ? "Отключить" : "Включить"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(u.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded text-xs text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Confirm delete */}
            {confirmDelete === u.id && (
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
                <span className="text-sm text-red-400">Удалить пользователя и все его данные?</span>
                <button
                  onClick={() => deleteUser.mutate(u.id)}
                  disabled={deleteUser.isPending}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded text-sm text-white font-medium transition-colors disabled:opacity-50"
                >
                  {deleteUser.isPending ? "..." : "Удалить"}
                </button>
                <button onClick={() => setConfirmDelete(null)}
                  className="px-3 py-1 bg-surface hover:bg-border rounded text-sm text-muted transition-colors">
                  Отмена
                </button>
              </div>
            )}

            {/* Credits inline edit */}
            {editingId === u.id && editMode === "credits" && (
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <button onClick={() => setAddAmount(a => ({ ...a, [u.id]: String(Math.max(0, Number(a[u.id] ?? 0) - 100) )}))}
                    className="p-1 bg-surface hover:bg-border rounded text-muted hover:text-white transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                  <input type="number" value={addAmount[u.id] ?? ""} onChange={e => setAddAmount(a => ({ ...a, [u.id]: e.target.value }))}
                    placeholder="Количество"
                    className="w-28 bg-surface border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent text-center" />
                  <button onClick={() => setAddAmount(a => ({ ...a, [u.id]: String(Number(a[u.id] ?? 0) + 100) }))}
                    className="p-1 bg-surface hover:bg-border rounded text-muted hover:text-white transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <button
                  onClick={() => { const amount = Number(addAmount[u.id]); if (amount > 0) addCredits.mutate({ id: u.id, amount }); }}
                  disabled={!addAmount[u.id] || Number(addAmount[u.id]) <= 0 || addCredits.isPending}
                  className="px-3 py-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded text-sm transition-colors">
                  {addCredits.isPending ? "..." : "Начислить"}
                </button>
                <span className="text-xs text-muted">кредитов</span>
              </div>
            )}

            {/* Storage inline edit */}
            {editingId === u.id && editMode === "storage" && (
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                <span className="text-xs text-muted">Квота (MB):</span>
                <input type="number" value={quotaInput[u.id] ?? u.storage_quota_mb}
                  onChange={e => setQuotaInput(q => ({ ...q, [u.id]: e.target.value }))}
                  className="w-24 bg-surface border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent text-center"
                  min="0" step="100" />
                <button
                  onClick={() => { const mb = Number(quotaInput[u.id]); if (mb >= 0) updateStorage.mutate({ id: u.id, storage_quota_mb: mb }); }}
                  disabled={updateStorage.isPending}
                  className="px-3 py-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded text-sm transition-colors">
                  {updateStorage.isPending ? "..." : "Сохранить"}
                </button>
                <span className="text-xs text-muted">Сейчас: {Number(u.storage_used_mb ?? 0).toFixed(1)} MB</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} qc={qc} />}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} qc={qc} />}
    </div>
  );
}

// ── Prices Tab ────────────────────────────────────────────────────────────────

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
                <div className="text-white text-sm font-medium">{OPERATION_LABELS[p.operation] ?? p.operation}</div>
                <div className="text-xs text-muted mt-0.5 font-mono">{p.operation}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs text-muted">Наценка %</span>
                  <input type="number" value={editingMarkup[p.operation] ?? p.markup_percent}
                    onChange={e => setEditingMarkup(prev => ({ ...prev, [p.operation]: e.target.value }))}
                    className="w-20 bg-surface border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent text-center"
                    min="0" max="1000" step="0.1" />
                </div>
                <button
                  onClick={() => { updatePrice.mutate({ operation: p.operation, credits, markup_percent: markup }); }}
                  disabled={updatePrice.isPending || unchanged}
                  className="px-3 py-1 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded text-sm transition-colors self-end mb-0.5">
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

// ── Transactions Tab ──────────────────────────────────────────────────────────

type TxRow = { id: string; email: string; name: string; amount: number; type: string; operation: string; description: string; created_at: string };

function TransactionsTab({ transactions }: { transactions: TxRow[] }) {
  return (
    <div className="space-y-2">
      {transactions.length === 0 && <p className="text-muted text-sm">Транзакций пока нет</p>}
      {transactions.map((t) => (
        <div key={t.id} className="bg-panel border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-white truncate">{t.description || t.operation}</div>
            <div className="text-xs text-muted">{t.email} · {new Date(t.created_at).toLocaleString("ru")}</div>
          </div>
          <div className={`text-sm font-medium flex-shrink-0 ${t.amount > 0 ? "text-green-400" : "text-red-400"}`}>
            {t.amount > 0 ? "+" : ""}{Number(t.amount).toFixed(3)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("stats");
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminApi.stats().then(r => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.users().then(r => r.data),
    enabled: tab === "users",
  });

  const { data: prices } = useQuery({
    queryKey: ["admin", "credit-prices"],
    queryFn: () => adminApi.creditPrices().then(r => r.data),
    enabled: tab === "prices",
  });

  const { data: transactions } = useQuery({
    queryKey: ["admin", "transactions"],
    queryFn: () => adminApi.transactions({ limit: 100 }).then(r => r.data),
    enabled: tab === "transactions",
  });

  const TAB_LIST = [
    { id: "stats" as Tab,        label: "Статистика",    icon: BarChart3 },
    { id: "users" as Tab,        label: "Пользователи",  icon: Users },
    { id: "prices" as Tab,       label: "Цены",          icon: Coins },
    { id: "transactions" as Tab, label: "Транзакции",    icon: History },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none px-6 pt-6 pb-0">
        <h1 className="text-xl font-semibold text-white mb-4">Панель администратора</h1>
        <div className="flex gap-1 border-b border-border">
          {TAB_LIST.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors ${
                tab === id ? "border-accent text-white" : "border-transparent text-muted hover:text-white"
              }`}>
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
