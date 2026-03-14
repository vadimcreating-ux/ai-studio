import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  Image, Video, Music,
  FolderOpen, Settings, Cpu, Bot, Sparkles, Zap, ChevronDown, MessageSquare,
} from "lucide-react";

const chatRoutes = [
  { to: "/claude",  label: "Claude",  icon: <Cpu      size={16} /> },
  { to: "/chatgpt", label: "ChatGPT", icon: <Bot      size={16} /> },
  { to: "/gemini",  label: "Gemini",  icon: <Sparkles size={16} /> },
];

const mediaItems = [
  { to: "/image", label: "Image", icon: <Image size={18} /> },
  { to: "/video", label: "Video", icon: <Video size={18} /> },
  { to: "/audio", label: "Audio", icon: <Music size={18} /> },
];

const sysItems = [
  { to: "/files",    label: "Files",    icon: <FolderOpen size={18} /> },
  { to: "/settings", label: "Settings", icon: <Settings   size={18} /> },
];

function ChatDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = chatRoutes.some(r => location.pathname.startsWith(r.to));
  const activeChat = chatRoutes.find(r => location.pathname.startsWith(r.to));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
          isActive
            ? "bg-accent text-white text-[16px] px-5 py-2.5 shadow-lg shadow-accent/20"
            : "text-[14px] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#1c2128]"
        }`}
      >
        {activeChat ? activeChat.icon : <MessageSquare size={18} />}
        <span>{activeChat ? activeChat.label : "Chat"}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-[#161b22] border border-border rounded-xl shadow-xl z-50 min-w-[140px] py-1">
          {chatRoutes.map(item => (
            <button
              key={item.to}
              onClick={() => { navigate(item.to); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-4 py-2 text-[14px] transition-colors hover:bg-[#1c2128] ${
                location.pathname.startsWith(item.to) ? "text-accent font-medium" : "text-[#8b949e] hover:text-[#c9d1d9]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopNav() {
  return (
    <header className="flex items-center h-[72px] border-b border-border bg-panel shrink-0 px-5 gap-1 overflow-x-auto scrollbar-none">

      {/* Logo → Dashboard */}
      <NavLink to="/dashboard" className="flex items-center gap-3 mr-4 shrink-0 hover:opacity-80 transition-opacity">
        <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center">
          <Zap size={22} className="text-white" fill="white" />
        </div>
        <div className="leading-none">
          <div className="text-[20px] font-bold text-white tracking-tight">AI Studio</div>
          <div className="text-[12px] text-muted mt-0.5 tracking-wide">by Vadim Kononenko</div>
        </div>
      </NavLink>

      {/* Chat dropdown */}
      <div className="flex items-center gap-0.5 shrink-0">
        <div className="w-px h-6 bg-border mx-2" />
        <ChatDropdown />
      </div>

      {/* Media */}
      <div className="flex items-center gap-0.5 shrink-0">
        <div className="w-px h-6 bg-border mx-2" />
        {mediaItems.map(item => (
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
        ))}
      </div>

      {/* System */}
      <div className="flex items-center gap-0.5 shrink-0">
        <div className="w-px h-6 bg-border mx-2" />
        {sysItems.map(item => (
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
        ))}
      </div>
    </header>
  );
}
