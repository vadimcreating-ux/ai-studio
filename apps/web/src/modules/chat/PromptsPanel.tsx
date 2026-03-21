import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { chatApi, type Chat } from "../../shared/api/chat";
import { projectsApi, type Project } from "../../shared/api/projects";
import { formatDate } from "../../shared/utils/date";

const ENGINE_MODELS: Record<string, Array<{ value: string; label: string }>> = {
  claude: [
    { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { value: "claude-opus-4-5", label: "Claude Opus 4.5" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
  chatgpt: [
    { value: "gpt-5-2", label: "GPT-5" },
    { value: "gpt-4o", label: "GPT-4o" },
  ],
  gemini: [
    { value: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
};

type Props = {
  engine: string;
  selectedProjectId: string | null;
  selectedChatId: string | null;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  defaultModel: string;
};

export default function PromptsPanel({
  engine, selectedProjectId, selectedChatId, onSelectChat, onNewChat, defaultModel,
}: Props) {
  const qc = useQueryClient();
  const [deleteChatConfirm, setDeleteChatConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveChatId, setMoveChatId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(defaultModel);

  const modelOptions = ENGINE_MODELS[engine] ?? [];

  const updateModel = useMutation({
    mutationFn: ({ id, model }: { id: string; model: string }) => chatApi.updateModel(id, model),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chats", engine, selectedProjectId] }),
  });

  function handleModelChange(model: string) {
    setSelectedModel(model);
    if (selectedChatId) updateModel.mutate({ id: selectedChatId, model });
  }

  const { data: chatsData } = useQuery({
    queryKey: ["chats", engine, selectedProjectId],
    queryFn: () => chatApi.list(engine, selectedProjectId ?? undefined),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects", engine],
    queryFn: () => projectsApi.list(engine),
  });

  const projects = projectsData?.projects ?? [];

  const createChat = useMutation({
    mutationFn: () => chatApi.create({ module: engine, model: selectedModel, project_id: selectedProjectId ?? undefined }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chats", engine, selectedProjectId] });
      onSelectChat(data.chat);
    },
  });

  const deleteChat = useMutation({
    mutationFn: (id: string) => chatApi.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["chats", engine, selectedProjectId] });
      if (selectedChatId === id) onNewChat();
      setDeleteChatConfirm(null);
    },
  });

  const renameChat = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => chatApi.rename(id, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chats", engine, selectedProjectId] });
      setRenameChatId(null);
    },
  });

  const moveChat = useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string | null }) =>
      chatApi.moveToProject(id, projectId),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["chats", engine, selectedProjectId] });
      if (selectedChatId === id) onNewChat();
      setMoveChatId(null);
    },
  });

  const allChats = chatsData?.chats ?? [];

  // Sync model selector to selected chat's model
  useEffect(() => {
    if (!selectedChatId) return;
    const chat = allChats.find((c) => c.id === selectedChatId);
    if (chat?.model) setSelectedModel(chat.model);
  }, [selectedChatId, allChats]);

  const chats = search.trim()
    ? allChats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : allChats;

  return (
    <div className="flex flex-col w-[240px] min-w-[240px] h-full bg-panel border-l border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-[13px] font-semibold text-white">История чатов</span>
        <button
          onClick={() => createChat.mutate()}
          disabled={createChat.isPending}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-surface hover:bg-border text-[#c9d1d9] transition-colors disabled:opacity-40"
        >
          <Plus size={11} />
          Новый чат
        </button>
      </div>

      {/* Model label */}
      {modelOptions.length > 0 && (
        <div className="px-3 py-2 border-b border-border shrink-0">
          <span className="text-[12px] text-[#c9d1d9]">
            {modelOptions.find((m) => m.value === selectedModel)?.label ?? selectedModel}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#1c2128] border border-border focus-within:border-accent transition-colors">
          <Search size={11} className="text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск чатов..."
            className="flex-1 bg-transparent text-[12px] text-white placeholder:text-muted outline-none"
          />
        </div>
      </div>

      {/* Chats list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {chats.length === 0 ? (
          <p className="px-4 py-3 text-[12px] text-muted leading-snug">
            {selectedProjectId ? "Нет диалогов в этом проекте." : "Нет диалогов. Нажмите «Новый чат»."}
          </p>
        ) : (
          chats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={selectedChatId === chat.id}
              onClick={() => onSelectChat(chat)}
              onDelete={() => setDeleteChatConfirm(chat.id)}
              onRename={() => { setRenameChatId(chat.id); setRenameValue(chat.title); }}
              onMoveToProject={() => setMoveChatId(chat.id)}
            />
          ))
        )}
      </div>

      {/* Delete confirmation */}
      {deleteChatConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteChatConfirm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[300px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Удалить диалог?</div>
            <div className="text-[13px] text-muted">История сообщений будет удалена. Это действие нельзя отменить.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteChatConfirm(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
              <button onClick={() => deleteChat.mutate(deleteChatConfirm)} disabled={deleteChat.isPending}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-[13px] text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                {deleteChat.isPending ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameChatId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setRenameChatId(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[320px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Переименовать чат</div>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameValue.trim()) renameChat.mutate({ id: renameChatId, title: renameValue.trim() });
                if (e.key === "Escape") setRenameChatId(null);
              }}
              className="input-field text-[13px] py-2"
              placeholder="Название чата"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenameChatId(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
              <button
                onClick={() => renameValue.trim() && renameChat.mutate({ id: renameChatId, title: renameValue.trim() })}
                disabled={!renameValue.trim() || renameChat.isPending}
                className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-[13px] text-white transition-colors disabled:opacity-50">
                {renameChat.isPending ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to project modal */}
      {moveChatId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setMoveChatId(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[320px] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Перенести в проект</div>
            {projects.length === 0 ? (
              <div className="text-[13px] text-muted">Нет доступных проектов.</div>
            ) : (
              <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto">
                <button
                  onClick={() => moveChat.mutate({ id: moveChatId, projectId: null })}
                  disabled={moveChat.isPending}
                  className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-muted hover:bg-surface hover:text-white transition-colors"
                >
                  Без проекта
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => moveChat.mutate({ id: moveChatId, projectId: p.id })}
                    disabled={moveChat.isPending}
                    className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-[#c9d1d9] hover:bg-surface hover:text-white transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setMoveChatId(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatItem({ chat, isActive, onClick, onDelete, onRename, onMoveToProject }: {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: () => void;
  onMoveToProject: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      onClick={onClick}
      className={`group px-4 py-3 cursor-pointer border-l-[3px] transition-all ${
        isActive ? "border-accent bg-[#1c2740]" : "border-transparent hover:bg-[#1c2128]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[13px] font-semibold truncate ${isActive ? "text-white" : "text-[#c9d1d9]"}`}>
            {chat.title}
          </div>
          <div className="text-[11px] text-muted mt-0.5">{formatDate(chat.created_at)}</div>
        </div>

        <div className="relative shrink-0 mt-0.5" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className={`p-0.5 rounded text-muted hover:text-white transition-all ${
              menuOpen ? "opacity-100 text-white" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <MoreHorizontal size={14} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-[160px] bg-[#161b22] border border-border rounded-lg shadow-xl overflow-hidden">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRename(); }}
                className="w-full text-left px-3 py-2 text-[12px] text-[#c9d1d9] hover:bg-[#21262d] hover:text-white transition-colors"
              >
                Переименовать
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onMoveToProject(); }}
                className="w-full text-left px-3 py-2 text-[12px] text-[#c9d1d9] hover:bg-[#21262d] hover:text-white transition-colors"
              >
                Перенести в проект
              </button>
              <div className="border-t border-border" />
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                className="w-full text-left px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Удалить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
