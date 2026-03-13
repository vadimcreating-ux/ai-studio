import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Image, Video, Music, User,
  FolderOpen, Settings, Cpu, Bot, Sparkles, Zap,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: React.ReactNode; disabled?: boolean };

const groups: Array<{ items: NavItem[] }> = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    items: [
      { to: "/claude",  label: "Claude",  icon: <Cpu      size={18} /> },
      { to: "/chatgpt", label: "ChatGPT", icon: <Bot      size={18} /> },
      { to: "/gemini",  label: "Gemini",  icon: <Sparkles size={18} /> },
    ],
  },
  {
    items: [
      { to: "/image",  label: "Image",  icon: <Image size={18} /> },
      { to: "/video",  label: "Video",  icon: <Video size={18} /> },
      { to: "/audio",  label: "Audio",  icon: <Music size={18} /> },
      { to: "/avatar", label: "Avatar", icon: <User  size={18} /> },
    ],
  },
  {
    items: [
      { to: "/files",    label: "Files",    icon: <FolderOpen size={18} /> },
      { to: "/settings", label: "Settings", icon: <Settings   size={18} /> },
    ],
  },
];

export default function TopNav() {
  return (
    <header className="flex items-center h-[72px] border-b border-border bg-panel shrink-0 px-5 gap-1 overflow-x-auto scrollbar-none">

      {/* Logo */}
      <div className="flex items-center gap-3 mr-4 shrink-0">
        <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center">
          <Zap size={22} className="text-white" fill="white" />
        </div>
        <div className="leading-none">
          <div className="text-[20px] font-bold text-white tracking-tight">AI Studio</div>
          <div className="text-[12px] text-muted mt-0.5 tracking-wide">by Vadim Kononenko</div>
        </div>
      </div>

      {/* Nav groups with separators */}
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5 shrink-0">
          <div className="w-px h-6 bg-border mx-2" />

          {group.items.map((item) =>
            item.disabled ? (
              <div key={item.to}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] text-[#484f58] cursor-not-allowed select-none"
                title="Недоступно">
                {item.icon}
                {item.label}
              </div>
            ) : (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-accent text-white text-[16px] px-5 py-2.5 shadow-lg shadow-accent/20"
                      : "text-[14px] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#1c2128]"
                  }`
                }>
                {item.icon}
                {item.label}
              </NavLink>
            )
          )}
        </div>
      ))}
    </header>
  );
}
