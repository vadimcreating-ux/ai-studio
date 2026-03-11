import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Image, Video, Music, User,
  FolderOpen, Settings, Cpu, Bot, Sparkles,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: React.ReactNode };

const sections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "ОСНОВНОЕ",
    items: [{ to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} /> }],
  },
  {
    title: "AI CHAT",
    items: [
      { to: "/claude",  label: "Claude",  icon: <Cpu      size={14} /> },
      { to: "/chatgpt", label: "ChatGPT", icon: <Bot      size={14} /> },
      { to: "/gemini",  label: "Gemini",  icon: <Sparkles size={14} /> },
    ],
  },
  {
    title: "MEDIA",
    items: [
      { to: "/image",  label: "Image",  icon: <Image size={14} /> },
      { to: "/video",  label: "Video",  icon: <Video size={14} /> },
      { to: "/audio",  label: "Audio",  icon: <Music size={14} /> },
      { to: "/avatar", label: "Avatar", icon: <User  size={14} /> },
    ],
  },
  {
    title: "СИСТЕМА",
    items: [
      { to: "/files",    label: "Files",    icon: <FolderOpen size={14} /> },
      { to: "/settings", label: "Settings", icon: <Settings   size={14} /> },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-[158px] min-w-[158px] h-full bg-panel border-r border-border overflow-y-auto scrollbar-thin">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4">
        <div className="text-[15px] font-semibold text-white leading-tight">KIE AI Studio</div>
        <div className="text-[11px] text-muted mt-1 leading-snug">
          Единый веб-интерфейс для AI-модулей
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 pb-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-1">
            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-muted uppercase">
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-4 py-[7px] text-[13px] transition-colors ${
                    isActive
                      ? "bg-accent text-white font-medium"
                      : "text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#1c2128]"
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
    </aside>
  );
}
