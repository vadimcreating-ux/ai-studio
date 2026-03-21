import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  X, User, Lock, Palette, Monitor, LogOut, Save,
  Eye, EyeOff, CheckCircle, AlertCircle, Sun, Moon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { profileApi } from "../shared/api/profile";

type Tab = "profile" | "security" | "theme" | "sessions";

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
            {tab === "theme"    && <ThemeTab />}
            {tab === "sessions" && <SessionsTab onClose={onClose} />}
          </div>
        </div>
      </div>
    </div>
  );
}
