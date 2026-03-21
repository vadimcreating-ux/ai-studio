import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  X, User, Lock, Palette, Monitor, LogOut, Save,
  Eye, EyeOff, CheckCircle, AlertCircle, Sun, Moon,
  Zap, BarChart2, TrendingDown, TrendingUp, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { profileApi } from "../shared/api/profile";
import { creditsApi, type CreditStatGroup, type CreditTransaction } from "../shared/api/credits";

type Tab = "profile" | "security" | "theme" | "sessions" | "credits";
type StatPeriod = "7d" | "30d" | "all";

const GROUP_META: Record<string, { color: string; bar: string }> = {
  "Чаты":        { color: "text-orange-400", bar: "bg-orange-400" },
  "Изображения": { color: "text-blue-400",   bar: "bg-blue-400" },
  "Видео":       { color: "text-pink-400",   bar: "bg-pink-400" },
  "Улучшения":   { color: "text-purple-400", bar: "bg-purple-400" },
  "Прочее":      { color: "text-muted",      bar: "bg-muted" },
};

const PERIOD_LABELS: Record<StatPeriod, string> = {
  "7d":  "7 дн.",
  "30d": "30 дн.",
  "all": "Всё время",
};

const TX_PAGE_SIZE = 10;

type Props = {
  onClose: () => void;
};

function Alert({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
      {type === "success" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {msg}
    </div>
  );
}

// ── Profile tab ──────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () => profileApi.update({
      name: name.trim() || undefined,
      avatar_url: avatarUrl.trim() || null,
    }),
    onSuccess: async () => {
      await refreshUser();
      setStatus({ type: "success", msg: "Профиль обновлён" });
      setTimeout(() => setStatus(null), 3000);
    },
    onError: (e: Error) => setStatus({ type: "error", msg: e.message }),
  });

  const initials = (user?.name ?? "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="space-y-5">
      {/* Avatar preview */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-accent flex items-center justify-center flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={() => setAvatarUrl("")} />
          ) : (
            <span className="text-white text-xl font-bold">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{user?.email}</p>
          <p className="text-xs text-muted mt-0.5">
            {user?.role === "admin" ? "Администратор" : "Пользователь"}
          </p>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs text-muted mb-1.5">Имя</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
          placeholder="Ваше имя"
          maxLength={100}
        />
      </div>

      {/* Avatar URL */}
      <div>
        <label className="block text-xs text-muted mb-1.5">URL аватара (необязательно)</label>
        <input
          type="url"
          value={avatarUrl}
          onChange={e => setAvatarUrl(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
          placeholder="https://example.com/avatar.jpg"
        />
        <p className="text-[11px] text-muted mt-1">Публичный URL изображения. Оставьте пустым для инициалов.</p>
      </div>

      {status && <Alert type={status.type} msg={status.msg} />}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
      >
        <Save size={14} />
        {mutation.isPending ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
}

// ── Security tab ─────────────────────────────────────────────────────────────
function SecurityTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () => profileApi.changePassword({ current_password: current, new_password: next }),
    onSuccess: () => {
      setCurrent(""); setNext(""); setConfirm("");
      setStatus({ type: "success", msg: "Пароль изменён. Вы остались в системе." });
      setTimeout(() => setStatus(null), 4000);
    },
    onError: (e: Error) => setStatus({ type: "error", msg: e.message }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setStatus({ type: "error", msg: "Новый пароль минимум 8 символов" });
    if (next !== confirm) return setStatus({ type: "error", msg: "Пароли не совпадают" });
    setStatus(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-muted mb-1.5">Текущий пароль</label>
        <div className="relative">
          <input
            type={showCurrent ? "text" : "password"}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
            placeholder="••••••••"
            required
          />
          <button type="button" onClick={() => setShowCurrent(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors">
            {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">Новый пароль</label>
        <div className="relative">
          <input
            type={showNext ? "text" : "password"}
            value={next}
            onChange={e => setNext(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
            placeholder="Минимум 8 символов"
            required minLength={8}
          />
          <button type="button" onClick={() => setShowNext(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors">
            {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">Подтверждение</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
          placeholder="Повторите новый пароль"
          required
        />
      </div>

      {/* Strength indicator */}
      {next.length > 0 && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[8, 12, 16].map((threshold, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${next.length >= threshold ? ["bg-red-500","bg-yellow-500","bg-green-500"][i] : "bg-surface"}`} />
            ))}
          </div>
          <p className="text-[11px] text-muted">
            {next.length < 8 ? "Слишком короткий" : next.length < 12 ? "Слабый" : next.length < 16 ? "Хороший" : "Надёжный"}
          </p>
        </div>
      )}

      {status && <Alert type={status.type} msg={status.msg} />}

      <button
        type="submit"
        disabled={mutation.isPending || !current || !next || !confirm}
        className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
      >
        <Lock size={14} />
        {mutation.isPending ? "Сохранение..." : "Изменить пароль"}
      </button>
    </form>
  );
}

// ── Theme tab ────────────────────────────────────────────────────────────────
function ThemeTab() {
  const [theme, setTheme] = useState<"dark" | "light" | "system">(() => {
    return (localStorage.getItem("theme") as "dark" | "light" | "system") ?? "dark";
  });

  function applyTheme(t: "dark" | "light" | "system") {
    setTheme(t);
    localStorage.setItem("theme", t);
    // Foundation: actual CSS variables switch would go here
    // For now just stores preference
  }

  const options = [
    { value: "dark" as const, label: "Тёмная", icon: <Moon size={18} />, desc: "Текущая тема по умолчанию" },
    { value: "light" as const, label: "Светлая", icon: <Sun size={18} />, desc: "Скоро" },
    { value: "system" as const, label: "Системная", icon: <Monitor size={18} />, desc: "Следовать настройкам ОС" },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Выберите тему оформления</p>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => applyTheme(opt.value)}
          disabled={opt.value !== "dark"}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left disabled:opacity-40 ${
            theme === opt.value
              ? "border-accent bg-accent/10"
              : "border-border bg-surface hover:border-border/60"
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === opt.value ? "bg-accent text-white" : "bg-panel text-muted"}`}>
            {opt.icon}
          </div>
          <div>
            <div className="text-sm text-white font-medium">{opt.label}</div>
            <div className="text-[11px] text-muted">{opt.desc}</div>
          </div>
          {theme === opt.value && (
            <CheckCircle size={14} className="text-accent ml-auto" />
          )}
        </button>
      ))}
      <p className="text-[11px] text-muted pt-2">Светлая тема и системная тема в разработке.</p>
    </div>
  );
}

// ── Sessions tab ─────────────────────────────────────────────────────────────
function SessionsTab({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => profileApi.logoutAll(),
    onSuccess: () => {
      setStatus({ type: "success", msg: "Все устройства отключены. Выход..." });
      setTimeout(() => {
        onClose();
        logout();
      }, 1500);
    },
    onError: (e: Error) => {
      setStatus({ type: "error", msg: e.message });
      setConfirming(false);
    },
  });

  return (
    <div className="space-y-5">
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-sm text-white font-medium">Текущий сеанс</span>
        </div>
        <p className="text-xs text-muted pl-5">Этот браузер · активен сейчас</p>
      </div>

      <div className="border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">Выйти со всех устройств</h3>
        <p className="text-xs text-muted leading-relaxed">
          Завершит все активные сессии на всех устройствах, включая текущую. После этого нужно будет войти заново.
        </p>

        {status && <Alert type={status.type} msg={status.msg} />}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-sm text-red-400 font-medium transition-colors"
          >
            <LogOut size={14} />
            Выйти со всех устройств
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "Выход..." : "Подтвердить"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-4 py-2 bg-surface hover:bg-border rounded-lg text-sm text-muted transition-colors"
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Credits tab ───────────────────────────────────────────────────────────────
function CreditsTab() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<StatPeriod>("30d");
  const [txPage, setTxPage] = useState(0);

  const { data: statsData } = useQuery({
    queryKey: ["settings-credit-stats", period],
    queryFn: () => creditsApi.stats(period),
  });

  const { data: txData } = useQuery({
    queryKey: ["settings-credit-history", txPage],
    queryFn: () => creditsApi.history(TX_PAGE_SIZE, txPage * TX_PAGE_SIZE),
  });

  const creditStats = (statsData as { ok: boolean; data: { period: string; total_spent: number; total_refunded: number; total_added: number; tx_count: number; by_group: CreditStatGroup[] } } | undefined)?.data;
  const byGroup = creditStats?.by_group ?? [];
  const maxGroupSpent = byGroup.reduce((m: number, g: CreditStatGroup) => Math.max(m, g.total_spent), 0);

  const txItems: CreditTransaction[] = (txData as { ok: boolean; data: { items: CreditTransaction[]; total: number } } | undefined)?.data?.items ?? [];
  const txTotal: number = (txData as { ok: boolean; data: { items: CreditTransaction[]; total: number } } | undefined)?.data?.total ?? 0;
  const totalPages = Math.ceil(txTotal / TX_PAGE_SIZE);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("ru", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-5">
      {/* Balance */}
      <div className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Zap size={18} className="text-accent" fill="currentColor" />
        </div>
        <div>
          <div className="text-xl font-bold text-white">{Number(user?.credits_balance ?? 0).toFixed(2)}</div>
          <div className="text-xs text-muted">текущий баланс</div>
        </div>
      </div>

      {/* Stats by period */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <BarChart2 size={14} className="text-accent" />
            Расход по группам
          </h3>
          <div className="flex gap-1">
            {(["7d", "30d", "all"] as StatPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-[11px] px-2 py-0.5 rounded-lg transition-colors ${
                  period === p ? "bg-accent text-white font-medium" : "bg-surface text-muted hover:text-white"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-lg font-bold text-white">{(creditStats?.total_spent ?? 0).toFixed(1)}</span>
            <span className="text-xs text-muted">потрачено · {creditStats?.tx_count ?? 0} операций</span>
          </div>
          {creditStats && creditStats.total_refunded > 0 && (
            <div className="text-xs text-green-400 mb-3">+{creditStats.total_refunded.toFixed(2)} возвращено</div>
          )}

          {byGroup.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">Нет данных за период</p>
          ) : (
            <div className="space-y-3 mt-3">
              {byGroup.map((g: CreditStatGroup) => {
                const meta = GROUP_META[g.group_name] ?? GROUP_META["Прочее"];
                const pct = maxGroupSpent > 0 ? (g.total_spent / maxGroupSpent) * 100 : 0;
                const markupPct = g.total_spent > 0 ? (g.markup_total / g.total_spent) * 100 : 0;
                return (
                  <div key={g.group_name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${meta.color}`}>{g.group_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted">наценка {markupPct.toFixed(0)}%</span>
                        <span className="text-xs text-white font-mono">{g.total_spent.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-panel rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">История транзакций</h3>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {txItems.length === 0 ? (
            <p className="text-xs text-muted text-center py-6">Транзакций пока нет</p>
          ) : (
            <div className="divide-y divide-border">
              {txItems.map((tx) => {
                const amt = Number(tx.amount);
                const isSpend = amt < 0;
                const groupMeta = GROUP_META[tx.group_name] ?? GROUP_META["Прочее"];
                return (
                  <div key={tx.id} className="flex items-center gap-2 px-4 py-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isSpend ? "bg-red-500/10" : "bg-green-500/10"}`}>
                      {isSpend
                        ? <TrendingDown size={11} className="text-red-400" />
                        : <TrendingUp size={11} className="text-green-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white truncate">{tx.description || tx.operation}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {tx.group_name && (
                          <span className={`text-[10px] ${groupMeta.color}`}>{tx.group_name}</span>
                        )}
                        {tx.kie_amount > 0 && (
                          <span className="text-[10px] text-muted">KIE: {Number(tx.kie_amount).toFixed(4)}</span>
                        )}
                        {tx.markup_percent > 0 && (
                          <span className="text-[10px] text-muted">+{Number(tx.markup_percent).toFixed(0)}%</span>
                        )}
                        <span className="text-[10px] text-muted">{formatDate(tx.created_at)}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-mono font-semibold flex-shrink-0 ${isSpend ? "text-red-400" : "text-green-400"}`}>
                      {amt > 0 ? "+" : ""}{amt.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 px-1">
            <button
              onClick={() => setTxPage(p => Math.max(0, p - 1))}
              disabled={txPage === 0}
              className="flex items-center gap-1 text-xs text-muted hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} /> Назад
            </button>
            <span className="text-xs text-muted">{txPage + 1} / {totalPages}</span>
            <button
              onClick={() => setTxPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={txPage >= totalPages - 1}
              className="flex items-center gap-1 text-xs text-muted hover:text-white disabled:opacity-30 transition-colors"
            >
              Вперёд <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function SettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile",  label: "Профиль",  icon: <User size={15} /> },
    { id: "security", label: "Безопасность", icon: <Lock size={15} /> },
    { id: "credits",  label: "Кредиты",  icon: <Zap size={15} /> },
    { id: "theme",    label: "Тема",     icon: <Palette size={15} /> },
    { id: "sessions", label: "Сессии",   icon: <Monitor size={15} /> },
  ];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-panel border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-white">Настройки</h2>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-40 border-r border-border flex-shrink-0 py-3">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm transition-colors text-left ${
                  tab === t.id
                    ? "text-accent bg-accent/10 font-medium"
                    : "text-muted hover:text-white hover:bg-surface"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {tab === "profile"  && <ProfileTab />}
            {tab === "security" && <SecurityTab />}
            {tab === "credits"  && <CreditsTab />}
            {tab === "theme"    && <ThemeTab />}
            {tab === "sessions" && <SessionsTab onClose={onClose} />}
          </div>
        </div>
      </div>
    </div>
  );
}
