import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  MessageSquare,
  Image,
  Video,
  Music,
  User,
  FolderOpen,
  Settings,
  Cpu,
  Bot,
  Sparkles,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

const sections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "ОСНОВНОЕ",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={15} /> },
    ],
  },
  {
    title: "AI CHAT",
    items: [
      { to: "/claude", label: "Claude", icon: <Cpu size={15} /> },
      { to: "/chatgpt", label: "ChatGPT", icon: <Bot size={15} /> },
      { to: "/gemini", label: "Gemini", icon: <Sparkles size={15} /> },
    ],
  },
  {
    title: "MEDIA",
    items: [
      { to: "/image", label: "Image", icon: <Image size={15} /> },
      { to: "/video", label: "Video", icon: <Video size={15} /> },
      { to: "/audio", label: "Audio", icon: <Music size={15} /> },
      { to: "/avatar", label: "Avatar", icon: <User size={15} /> },
    ],
  },
  {
    title: "СИСТЕМА",
    items: [
      { to: "/files", label: "Files", icon: <FolderOpen size={15} /> },
      { to: "/settings", label: "Settings", icon: <Settings size={15} /> },
    ],
  },
];

function useBackendStatus() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/health");
      if (!res.ok) throw new Error("offline");
      return res.json();
    },
    refetchInterval: 30_000,
    retry: false,
  });
}

export default function Sidebar() {
  const { data, isError } = useBackendStatus();
  const online = !!data?.ok && !isError;

  return (
    <aside className="flex flex-col w-[160px] min-w-[160px] h-full bg-panel border-r border-border overflow-y-auto scrollbar-thin">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <div className="text-[15px] font-semibold text-white leading-tight">
          KIE AI Studio
        </div>
        <div className="text-[11px] text-muted mt-1 leading-snug">
          Единый веб-интерфейс для AI-модулей
        </div>
      </div>

      {/* Backend status */}
      <div className="px-4 py-2 border-b border-border">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
            online
              ? "bg-success/20 text-green-400"
              : "bg-red-900/30 text-red-400"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              online ? "bg-green-400" : "bg-red-400"
            }`}
          />
          {online ? "Backend online" : "Offline"}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            <div className="px-4 mb-1 text-[10px] font-semibold tracking-wider text-muted uppercase">
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-4 py-1.5 text-[13px] transition-colors ${
                    isActive
                      ? "bg-accent text-white font-medium"
                      : "text-[#c9d1d9] hover:bg-surface hover:text-white"
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <MessageSquare size={11} />
          v0.1 MVP
        </div>
      </div>
    </aside>
  );
}
