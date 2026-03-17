import { useNavigate } from "react-router-dom";
import { Cpu, Bot, Sparkles, Image, Video, Music, User, FolderOpen } from "lucide-react";

const engines = [
  {
    to: "/claude",
    label: "Claude",
    icon: <Cpu size={20} />,
    description: "Anthropic Claude — мощный AI для текста, анализа и задач.",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
  },
  {
    to: "/chatgpt",
    label: "ChatGPT",
    icon: <Bot size={20} />,
    description: "OpenAI GPT — генерация текста, идеи, контент, код.",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  {
    to: "/gemini",
    label: "Gemini",
    icon: <Sparkles size={20} />,
    description: "Google Gemini — мультимодальный AI от Google.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
];

const mediaModules = [
  { to: "/image", label: "Image", icon: <Image size={16} />, description: "Генерация изображений через KIE API" },
  { to: "/video", label: "Video", icon: <Video size={16} />, description: "Text-to-video и image-to-video" },
  { to: "/audio", label: "Audio", icon: <Music size={16} />, description: "Музыка, TTS, аудио" },
  { to: "/avatar", label: "Avatar", icon: <User size={16} />, description: "Avatar-видео из фото и аудио" },
  { to: "/files", label: "Files", icon: <FolderOpen size={16} />, description: "Библиотека результатов" },
];

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-8 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-white mb-1">KIE AI Studio</h1>
        <p className="text-[14px] text-muted">
          Единое место для работы с AI-модулями. Выберите модуль и начните работу.
        </p>
      </div>

      {/* AI Chat engines */}
      <div className="mb-8">
        <h2 className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-3">
          AI Chat
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {engines.map((e) => (
            <button
              key={e.to}
              onClick={() => navigate(e.to)}
              className={`text-left p-4 rounded-xl border ${e.bg} hover:opacity-90 transition-opacity`}
            >
              <div className={`mb-2 ${e.color}`}>{e.icon}</div>
              <div className="text-[15px] font-semibold text-white mb-1">{e.label}</div>
              <div className="text-[12px] text-muted leading-snug">{e.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Media modules */}
      <div className="mb-8">
        <h2 className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-3">
          Media & Files
        </h2>
        <div className="grid grid-cols-5 gap-3">
          {mediaModules.map((m) => (
            <button
              key={m.to}
              onClick={() => navigate(m.to)}
              className="text-left p-3 rounded-xl border border-border bg-panel hover:bg-surface transition-colors"
            >
              <div className="mb-1.5 text-muted">{m.icon}</div>
              <div className="text-[13px] font-medium text-white mb-0.5">{m.label}</div>
              <div className="text-[11px] text-muted leading-snug">{m.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
