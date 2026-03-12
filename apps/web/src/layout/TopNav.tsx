import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Image, Video, Music, User,
  FolderOpen, Settings, Cpu, Bot, Sparkles, Zap,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: React.ReactNode; disabled?: boolean };

const groups: Array<{ items: NavItem[] }> = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={13} /> },
    ],
  },
  {
    items: [
      { to: "/claude",  label: "Claude",  icon: <Cpu      size={13} />, disabled: true },
      { to: "/chatgpt", label: "ChatGPT", icon: <Bot      size={13} /> },
      { to: "/gemini",  label: "Gemini",  icon: <Sparkles size={13} /> },
    ],
  },
  {
    items: [
      { to: "/image",  label: "Image",  icon: <Image size={13} /> },
      { to: "/video",  label: "Video",  icon: <Video size={13} /> },
      { to: "/audio",  label: "Audio",  icon: <Music size={13} /> },
      { to: "/avatar", label: "Avatar", icon: <User  size={13} /> },
    ],
  },
  {
    items: [
      { to: "/files",    label: "Files",    icon: <FolderOpen size={13} /> },
      { to: "/settings", label: "Settings", icon: <Settings   size={13} /> },
    ],
  },
];

export default function TopNav() {
  return (
    <header className="flex items-center h-12 border-b border-border bg-panel shrink-0 px-4 gap-1 overflow-x-auto scrollbar-none">

      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-3 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
          <Zap size={14} className="text-white" fill="white" />
        </div>
        <div className="leading-none">
          <div className="text-[14px] font-bold text-white tracking-tight">AI Studio</div>
          <div className="text-[9px] text-muted mt-0.5 tracking-wide">by Vadim Kononenko</div>
        </div>
      </div>

      {/* Nav groups with separators */}
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5 shrink-0">
          {/* Separator before each group */}
          <div className="w-px h-4 bg-border mx-1.5" />

          {group.items.map((item) =>
            item.disabled ? (
              <div key={item.to}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] text-[#484f58] cursor-not-allowed select-none"
                title="Недоступно">
                {item.icon}
                {item.label}
              </div>
            ) : (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-accent text-white"
                      : "text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#1c2128]"
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
