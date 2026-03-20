import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useQuery as useAuthQuery } from "@tanstack/react-query";
import {
  Zap, Cpu, Bot, Sparkles, Image, Video, Music,
  HardDrive, FolderOpen, MessageSquare, TrendingDown,
  TrendingUp, Clock, ArrowRight, Play,
} from "lucide-react";
import { authApi } from "../shared/api/auth";
import { creditsApi } from "../shared/api/credits";
import { api } from "../shared/api/client";
import { chatApi } from "../shared/api/chat";
import type { Chat } from "../shared/api/chat";

type FileItem = {
  id: string;
  type: "image" | "video";
  url: string;
  prompt: string | null;
  createdAt: string;
  fileSizeBytes: number | null;
};

type CreditTx = {
  id: string;
  amount: number;
  operation: string;
  description: string;
  created_at: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин. назад`;
  if (diffH < 24) return `${diffH} ч. назад`;
  if (diffD === 1) return "вчера";
  if (diffD < 7) return `${diffD} дн. назад`;
  return d.toLocaleString("ru", { day: "2-digit", month: "short" });
}

const ENGINE_META = {
  claude:  { label: "Claude",  icon: <Cpu size={14} />,      color: "text-orange-400",  bg: "bg-orange-500/10" },
  chatgpt: { label: "ChatGPT", icon: <Bot size={14} />,      color: "text-green-400",   bg: "bg-green-500/10" },
  gemini:  { label: "Gemini",  icon: <Sparkles size={14} />, color: "text-purple-400",  bg: "bg-purple-500/10" },
};

const OP_LABELS: Record<string, string> = {
  chat_claude:      "Чат Claude",
  chat_chatgpt:     "Чат ChatGPT",
  chat_gemini:      "Чат Gemini",
  image_generate:   "Генерация изображения",
  video_generate:   "Генерация видео",
  prompt_improve:   "Улучшение промпта",
  credits_added:    "Пополнение",
};

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: me } = useAuthQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me().then((r) => r.data),
  });

  const { data: filesData } = useQuery({
    queryKey: ["dashboard-files"],
    queryFn: () => api.get<{ ok: boolean; files: FileItem[]; total: number }>(
      "/api/files?limit=6&offset=0"
    ),
  });

  const { data: claudeChats } = useQuery({
    queryKey: ["dashboard-chats-claude"],
    queryFn: () => chatApi.list("claude", undefined, 4),
  });

  const { data: chatgptChats } = useQuery({
    queryKey: ["dashboard-chats-chatgpt"],
    queryFn: () => chatApi.list("chatgpt", undefined, 4),
  });

  const { data: geminiChats } = useQuery({
    queryKey: ["dashboard-chats-gemini"],
    queryFn: () => chatApi.list("gemini", undefined, 4),
  });

  const { data: txData } = useQuery({
    queryKey: ["dashboard-transactions"],
    queryFn: () => creditsApi.history(8, 0),
  });

  const files = filesData?.files ?? [];
  const totalFiles = filesData?.total ?? 0;
  const txList: CreditTx[] = txData?.data?.items ?? [];

  const usedMb = Number(me?.storage_used_mb ?? 0);
  const quotaMb = Number(me?.storage_quota_mb ?? 500);
  const storagePct = quotaMb > 0 ? Math.min(100, (usedMb / quotaMb) * 100) : 0;
  const storageColor = storagePct >= 90 ? "bg-red-500" : storagePct >= 70 ? "bg-yellow-500" : "bg-accent";

  const allChats = [
    ...(claudeChats?.chats ?? []),
    ...(chatgptChats?.chats ?? []),
    ...(geminiChats?.chats ?? []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);

  const totalChats =
    (claudeChats?.total ?? 0) +
    (chatgptChats?.total ?? 0) +
    (geminiChats?.total ?? 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return "Доброй ночи";
    if (h < 12) return "Доброе утро";
    if (h < 18) return "Добрый день";
    return "Добрый вечер";
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Hero ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {greeting()}{me?.name ? `, ${me.name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-muted mt-1 text-sm">Что создаём сегодня?</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-panel border border-border rounded-xl">
            <Zap size={16} className="text-accent" fill="currentColor" />
            <span className="text-white font-semibold text-lg">{Number(me?.credits_balance ?? 0).toFixed(1)}</span>
            <span className="text-muted text-sm">кредитов</span>
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Claude", desc: "Sonnet 4.5", icon: <Cpu size={20} />, color: "hover:border-orange-500/40 hover:bg-orange-500/5", iconColor: "text-orange-400 bg-orange-500/10", to: "/claude" },
            { label: "ChatGPT", desc: "GPT-5 / 4o", icon: <Bot size={20} />, color: "hover:border-green-500/40 hover:bg-green-500/5", iconColor: "text-green-400 bg-green-500/10", to: "/chatgpt" },
            { label: "Gemini", desc: "2.5 Pro", icon: <Sparkles size={20} />, color: "hover:border-purple-500/40 hover:bg-purple-500/5", iconColor: "text-purple-400 bg-purple-500/10", to: "/gemini" },
            { label: "Image", desc: "7 моделей", icon: <Image size={20} />, color: "hover:border-blue-500/40 hover:bg-blue-500/5", iconColor: "text-blue-400 bg-blue-500/10", to: "/image" },
            { label: "Video", desc: "Sora / Kling", icon: <Video size={20} />, color: "hover:border-pink-500/40 hover:bg-pink-500/5", iconColor: "text-pink-400 bg-pink-500/10", to: "/video" },
          ].map((item) => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className={`flex flex-col items-start gap-3 p-4 bg-panel border border-border rounded-xl transition-all ${item.color} group`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.iconColor}`}>
                {item.icon}
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white group-hover:text-white">{item.label}</div>
                <div className="text-xs text-muted mt-0.5">{item.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Credits */}
          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted uppercase tracking-wide">Баланс</span>
              <Zap size={15} className="text-accent" />
            </div>
            <div className="text-2xl font-bold text-white">{Number(me?.credits_balance ?? 0).toFixed(1)}</div>
            <div className="text-xs text-muted mt-1">кредитов</div>
          </div>

          {/* Storage */}
          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted uppercase tracking-wide">Хранилище</span>
              <HardDrive size={15} className="text-muted" />
            </div>
            <div className="text-2xl font-bold text-white">{usedMb.toFixed(0)}</div>
            <div className="text-xs text-muted mt-1">из {quotaMb} MB</div>
            <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${storageColor}`} style={{ width: `${storagePct}%` }} />
            </div>
          </div>

          {/* Files */}
          <div
            className="bg-panel border border-border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors"
            onClick={() => navigate("/files")}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted uppercase tracking-wide">Файлы</span>
              <FolderOpen size={15} className="text-muted" />
            </div>
            <div className="text-2xl font-bold text-white">{totalFiles}</div>
            <div className="text-xs text-muted mt-1">изображений и видео</div>
          </div>

          {/* Chats */}
          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted uppercase tracking-wide">Чаты</span>
              <MessageSquare size={15} className="text-muted" />
            </div>
            <div className="text-2xl font-bold text-white">{totalChats}</div>
            <div className="text-xs text-muted mt-1">всего диалогов</div>
          </div>
        </div>

        {/* ── Recent files + Credit history ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent files — 2/3 width */}
          <div className="lg:col-span-2 bg-panel border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Последние файлы</h2>
              {totalFiles > 6 && (
                <button
                  onClick={() => navigate("/files")}
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  Все файлы <ArrowRight size={12} />
                </button>
              )}
            </div>

            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 text-center">
                <FolderOpen size={28} className="text-muted mb-2" />
                <p className="text-sm text-muted">Файлов пока нет</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => navigate("/image")} className="text-xs text-accent hover:underline">Сгенерировать изображение</button>
                  <span className="text-muted text-xs">·</span>
                  <button onClick={() => navigate("/video")} className="text-xs text-accent hover:underline">Создать видео</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {files.map((f) => (
                  <a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-lg overflow-hidden bg-surface group block"
                    title={f.prompt ?? ""}
                  >
                    {f.type === "video" ? (
                      <>
                        <video src={f.url} className="w-full h-full object-cover" muted playsInline />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play size={16} className="text-white" />
                        </div>
                      </>
                    ) : (
                      <img src={f.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-white/80 truncate">{formatDate(f.createdAt)}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Credit history — 1/3 width */}
          <div className="bg-panel border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">История кредитов</h2>
              <Clock size={14} className="text-muted" />
            </div>

            {txList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 text-center">
                <Clock size={24} className="text-muted mb-2" />
                <p className="text-sm text-muted">Транзакций пока нет</p>
              </div>
            ) : (
              <div className="space-y-2">
                {txList.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${tx.amount > 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                        {tx.amount > 0
                          ? <TrendingUp size={12} className="text-green-400" />
                          : <TrendingDown size={12} className="text-red-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-white truncate">
                          {OP_LABELS[tx.operation] ?? tx.operation}
                        </p>
                        <p className="text-[10px] text-muted">{formatDate(tx.created_at)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-mono font-medium flex-shrink-0 ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent chats ── */}
        <div className="bg-panel border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Последние чаты</h2>
            <span className="text-xs text-muted">{totalChats} всего</span>
          </div>

          {allChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-center">
              <MessageSquare size={24} className="text-muted mb-2" />
              <p className="text-sm text-muted">Чатов пока нет — начни новый диалог</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {allChats.map((chat) => {
                const engine = chat.module as keyof typeof ENGINE_META;
                const meta = ENGINE_META[engine] ?? ENGINE_META.claude;
                return (
                  <button
                    key={chat.id}
                    onClick={() => navigate(`/${engine}`)}
                    className="flex items-center gap-3 p-3 bg-surface hover:bg-border rounded-xl text-left transition-colors group"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                      <span className={meta.color}>{meta.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate group-hover:text-white">
                        {chat.title || "Новый чат"}
                      </p>
                      <p className="text-[11px] text-muted">{meta.label} · {formatDate(chat.created_at)}</p>
                    </div>
                    <ArrowRight size={12} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Audio / Avatar coming soon ── */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Audio", desc: "Text-to-Speech и транскрипция", icon: <Music size={20} />, to: "/audio", color: "text-cyan-400 bg-cyan-500/10" },
            { label: "Avatar", desc: "AI-аватары в разных стилях", icon: <Sparkles size={20} />, to: "/avatar", color: "text-yellow-400 bg-yellow-500/10" },
          ].map((item) => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className="flex items-center gap-4 p-4 bg-panel border border-dashed border-border hover:border-border/80 rounded-xl transition-colors group text-left opacity-60 hover:opacity-80"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                {item.icon}
              </div>
              <div>
                <div className="text-sm font-medium text-white">{item.label}</div>
                <div className="text-xs text-muted">{item.desc}</div>
              </div>
              <div className="ml-auto">
                <span className="text-[10px] text-muted bg-surface px-2 py-0.5 rounded-full">Скоро</span>
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
