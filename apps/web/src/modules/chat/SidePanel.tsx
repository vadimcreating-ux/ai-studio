import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, ChevronRight, MoreHorizontal,
  Brain, Trash2, FolderOpen, MessageSquare, FolderInput,
} from "lucide-react";
import { chatApi, type Chat } from "../../shared/api/chat";
import { projectsApi, type Project } from "../../shared/api/projects";
import { engineSettingsApi } from "../../shared/api/engine-settings";
import GlobalMemoryModal from "./GlobalMemoryModal";
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
  ],
};

type Props = {
  engine: string;
  engineLabel: string;
  selectedProjectId: string | null;
  selectedChatId: string | null;
  onSelectProject: (id: string | null) => void;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  defaultModel: string;
  onModelChange?: (model: string) => void;
};

export default function SidePanel({
  engine, engineLabel, selectedProjectId, selectedChatId,
  onSelectProject, onSelectChat, onNewChat, defaultModel, onModelChange,
}: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<string | null>(null);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameProjectValue, setRenameProjectValue] = useState("");
  const [deleteChatConfirm, setDeleteChatConfirm] = useState<string | null>(null);
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveChatId, setMoveChatId] = useState<string | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [dragChatId, setDragChatId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null | "drafts">(undefined as unknown as null);

  const modelOptions = ENGINE_MODELS[engine] ?? [];

  // ── Queries ──
  const { data: projectsData } = useQuery({
    queryKey: ["projects", engine],
    queryFn: () => projectsApi.list(engine),
  });

  const { data: chatsData } = useQuery({
    queryKey: ["chats-all", engine],
    queryFn: () => chatApi.list(engine, undefined, 200),
  });

  const { data: memoryData } = useQuery({
    queryKey: ["engine-settings", engine],
    queryFn: () => engineSettingsApi.get(engine),
  });

  const projects = projectsData?.projects ?? [];
  const allChats = chatsData?.chats ?? [];
  const hasGlobalMemory = !!(
    memoryData?.settings?.about?.trim() ||
    memoryData?.settings?.instructions?.trim() ||
    memoryData?.settings?.memory?.trim()
  );

  // Sync model to selected chat
  useEffect(() => {
    if (!selectedChatId) return;
    const chat = allChats.find((c) => c.id === selectedChatId);
    if (chat?.model) setSelectedModel(chat.model);
  }, [selectedChatId, allChats]);

  // Auto-expand project of active chat
  useEffect(() => {
    if (!selectedChatId) return;
    const chat = allChats.find((c) => c.id === selectedChatId);
    if (chat?.project_id) {
      setExpandedProjects((prev) => new Set([...prev, chat.project_id!]));
    }
  }, [selectedChatId, allChats]);

  // ── Mutations ──
  const createChat = useMutation({
    mutationFn: () => chatApi.create({ module: engine, model: selectedModel, project_id: selectedProjectId ?? undefined }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chats-all", engine] });
      onSelectChat(data.chat);
    },
  });

  const createProject = useMutation({
    mutationFn: (name: string) => projectsApi.create({ module: engine, name }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["projects", engine] });
      onSelectProject(data.project.id);
      setExpandedProjects((prev) => new Set([...prev, data.project.id]));
      setNewProjectName("");
      setShowNewProject(false);
    },
  });

  const renameProject = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      projectsApi.update(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", engine] });
      setRenameProjectId(null);
    },
  });

  const deleteProject = useMutation({
    mutationFn: ({ id, moveChats }: { id: string; moveChats: boolean }) =>
      projectsApi.delete(id, moveChats),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["projects", engine] });
      qc.invalidateQueries({ queryKey: ["chats-all", engine] });
      if (selectedProjectId === id) onSelectProject(null);
      setDeleteProjectConfirm(null);
    },
  });

  const deleteChat = useMutation({
    mutationFn: (id: string) => chatApi.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["chats-all", engine] });
      if (selectedChatId === id) onNewChat();
      setDeleteChatConfirm(null);
    },
  });

  const renameChat = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => chatApi.rename(id, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chats-all", engine] });
      setRenameChatId(null);
    },
  });

  const moveChat = useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string | null }) =>
      chatApi.moveToProject(id, projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chats-all", engine] });
      setMoveChatId(null);
    },
  });

  const updateModel = useMutation({
    mutationFn: ({ id, model }: { id: string; model: string }) => chatApi.updateModel(id, model),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chats-all", engine] }),
  });

  function handleModelChange(model: string) {
    setSelectedModel(model);
    onModelChange?.(model);
    if (selectedChatId) updateModel.mutate({ id: selectedChatId, model });
  }

  // ── Drag & Drop ──
  function handleDragStart(chatId: string) {
    setDragChatId(chatId);
  }
  function handleDragEnd() {
    setDragChatId(null);
    setDragOverProjectId(null as unknown as null);
  }
  function handleDragOver(e: React.DragEvent, projectId: string | null) {
    e.preventDefault();
    setDragOverProjectId(projectId === null ? "drafts" : projectId);
  }
  function handleDrop(e: React.DragEvent, targetProjectId: string | null) {
    e.preventDefault();
    if (dragChatId) {
      moveChat.mutate({ id: dragChatId, projectId: targetProjectId });
    }
    setDragChatId(null);
    setDragOverProjectId(null as unknown as null);
  }

  // ── Filtering ──
  const q = search.toLowerCase().trim();

  const filteredProjects = q
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        allChats.some((c) => c.project_id === p.id && c.title.toLowerCase().includes(q))
      )
    : projects;

  function chatsForProject(projectId: string | null) {
    const base = allChats.filter((c) => c.project_id === projectId);
    return q ? base.filter((c) => c.title.toLowerCase().includes(q)) : base;
  }

  const draftChats = chatsForProject(null);

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col w-[260px] min-w-[260px] h-full bg-panel border-r border-border overflow-hidden">

      {/* ── New chat button ── */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={() => createChat.mutate()}
          disabled={createChat.isPending}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-accent hover:bg-accent-hover text-white text-[13px] font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          <Plus size={15} />
          Новый чат
        </button>
      </div>

      {/* ── Model selector ── */}
      {modelOptions.length > 0 && (
        <div className="px-3 pb-2 shrink-0">
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-[#c9d1d9] outline-none focus:border-accent transition-colors cursor-pointer"
          >
            {modelOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Search ── */}
      <div className="px-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#1c2128] border border-border focus-within:border-accent transition-colors">
          <Search size={11} className="text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск проектов и чатов..."
            className="flex-1 bg-transparent text-[12px] text-white placeholder:text-muted outline-none"
          />
        </div>
      </div>

      {/* ── Tree ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* Projects section header */}
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Проекты</span>
          <button
            onClick={() => setShowNewProject(true)}
            className="p-0.5 rounded text-muted hover:text-white transition-colors"
            title="Создать проект"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* New project inline input */}
        {showNewProject && (
          <div className="mx-3 mb-2 p-2 bg-[#1c2128] border border-border rounded-lg">
            <input
              autoFocus
              type="text"
              placeholder="Название проекта"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newProjectName.trim()) createProject.mutate(newProjectName.trim());
                if (e.key === "Escape") { setShowNewProject(false); setNewProjectName(""); }
              }}
              className="w-full bg-base border border-border rounded px-2 py-1 text-[12px] text-white placeholder:text-muted outline-none focus:border-accent"
            />
            <div className="flex gap-1.5 mt-1.5">
              <button
                disabled={!newProjectName.trim()}
                onClick={() => newProjectName.trim() && createProject.mutate(newProjectName.trim())}
                className="flex-1 text-[11px] py-1 rounded bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors"
              >Создать</button>
              <button
                onClick={() => { setShowNewProject(false); setNewProjectName(""); }}
                className="flex-1 text-[11px] py-1 rounded bg-surface hover:bg-border text-muted transition-colors"
              >Отмена</button>
            </div>
          </div>
        )}

        {/* Project items */}
        {filteredProjects.map((project) => {
          const isExpanded = expandedProjects.has(project.id);
          const projectChats = chatsForProject(project.id);
          const hasActive = projectChats.some((c) => c.id === selectedChatId);
          const isDragTarget = dragOverProjectId === project.id;

          return (
            <div key={project.id}>
              <ProjectRow
                project={project}
                isExpanded={isExpanded}
                hasActiveChild={hasActive}
                isDragTarget={isDragTarget}
                isActiveProject={selectedProjectId === project.id}
                onToggle={() => toggleProject(project.id)}
                onSelect={() => onSelectProject(selectedProjectId === project.id ? null : project.id)}
                onDelete={() => setDeleteProjectConfirm(project.id)}
                onRename={() => { setRenameProjectId(project.id); setRenameProjectValue(project.name); }}
                onDragOver={(e) => handleDragOver(e, project.id)}
                onDrop={(e) => handleDrop(e, project.id)}
                onDragLeave={() => setDragOverProjectId(null as unknown as null)}
              />
              {isExpanded && (
                <div className="ml-4 border-l border-border/50 pl-0">
                  {projectChats.length === 0 ? (
                    <p className="pl-4 py-2 text-[11px] text-muted">Нет чатов</p>
                  ) : (
                    projectChats.map((chat) => (
                      <ChatRow
                        key={chat.id}
                        chat={chat}
                        isActive={selectedChatId === chat.id}
                        onSelect={() => { onSelectChat(chat); onSelectProject(project.id); }}
                        onDelete={() => setDeleteChatConfirm(chat.id)}
                        onRename={() => { setRenameChatId(chat.id); setRenameValue(chat.title); }}
                        onMoveToProject={() => setMoveChatId(chat.id)}
                        onDragStart={() => handleDragStart(chat.id)}
                        onDragEnd={handleDragEnd}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredProjects.length === 0 && !showNewProject && (
          <p className="px-3 py-2 text-[12px] text-muted">Нет проектов.</p>
        )}

        {/* Drafts section */}
        <div className="mt-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none transition-colors ${
              dragOverProjectId === "drafts" ? "bg-accent/10 border border-accent/30 rounded-lg mx-2" : ""
            }`}
            onDragOver={(e) => handleDragOver(e, null)}
            onDrop={(e) => handleDrop(e, null)}
            onDragLeave={() => setDragOverProjectId(null as unknown as null)}
          >
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider flex-1">Черновики</span>
            <span className="text-[10px] text-muted">{draftChats.length}</span>
          </div>

          {draftChats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              isActive={selectedChatId === chat.id}
              onSelect={() => { onSelectChat(chat); onSelectProject(null); }}
              onDelete={() => setDeleteChatConfirm(chat.id)}
              onRename={() => { setRenameChatId(chat.id); setRenameValue(chat.title); }}
              onMoveToProject={() => setMoveChatId(chat.id)}
              onDragStart={() => handleDragStart(chat.id)}
              onDragEnd={handleDragEnd}
            />
          ))}

          {draftChats.length === 0 && (
            <p className="px-3 py-1.5 text-[11px] text-muted">Нет черновиков</p>
          )}
        </div>
      </div>

      {/* ── Global memory button ── */}
      <div className="px-3 py-2.5 border-t border-border shrink-0">
        <button
          onClick={() => setShowMemory(true)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-colors ${
            hasGlobalMemory
              ? "bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20"
              : "bg-surface hover:bg-border text-muted hover:text-white border border-transparent"
          }`}
        >
          <Brain size={13} className="shrink-0" />
          <span className="flex-1 text-left">Персонализация</span>
          {hasGlobalMemory && <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
        </button>
      </div>

      {/* ── Modals ── */}

      {showMemory && (
        <GlobalMemoryModal engine={engine} engineLabel={engineLabel} onClose={() => setShowMemory(false)} />
      )}

      {/* Rename project */}
      {renameProjectId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setRenameProjectId(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[320px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Переименовать проект</div>
            <input
              autoFocus
              value={renameProjectValue}
              onChange={(e) => setRenameProjectValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameProjectValue.trim()) renameProject.mutate({ id: renameProjectId, name: renameProjectValue.trim() });
                if (e.key === "Escape") setRenameProjectId(null);
              }}
              className="input-field text-[13px] py-2"
              placeholder="Название проекта"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenameProjectId(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
              <button
                onClick={() => renameProjectValue.trim() && renameProject.mutate({ id: renameProjectId, name: renameProjectValue.trim() })}
                disabled={!renameProjectValue.trim() || renameProject.isPending}
                className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-[13px] text-white transition-colors disabled:opacity-50">
                {renameProject.isPending ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete project */}
      {deleteProjectConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteProjectConfirm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[340px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Удалить проект?</div>
            <div className="text-[13px] text-muted leading-relaxed">
              Что сделать с чатами внутри проекта?
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => deleteProject.mutate({ id: deleteProjectConfirm, moveChats: true })}
                disabled={deleteProject.isPending}
                className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-[13px] text-[#c9d1d9] hover:border-accent/40 hover:text-white transition-colors text-left flex items-center gap-2 disabled:opacity-50"
              >
                <FolderInput size={14} className="text-accent shrink-0" />
                <div>
                  <div className="font-medium">Удалить проект, сохранить чаты</div>
                  <div className="text-[11px] text-muted mt-0.5">Чаты переместятся в «Черновики»</div>
                </div>
              </button>
              <button
                onClick={() => deleteProject.mutate({ id: deleteProjectConfirm, moveChats: false })}
                disabled={deleteProject.isPending}
                className="w-full px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-400 hover:bg-red-500/20 transition-colors text-left flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={14} className="shrink-0" />
                <div>
                  <div className="font-medium">Удалить всё</div>
                  <div className="text-[11px] text-red-400/70 mt-0.5">Проект и все чаты будут удалены навсегда</div>
                </div>
              </button>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setDeleteProjectConfirm(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete chat */}
      {deleteChatConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteChatConfirm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[300px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Удалить диалог?</div>
            <div className="text-[13px] text-muted">История сообщений будет удалена. Это нельзя отменить.</div>
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

      {/* Rename chat */}
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

      {/* Move to project */}
      {moveChatId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setMoveChatId(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[320px] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Перенести в проект</div>
            <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto">
              <button
                onClick={() => moveChat.mutate({ id: moveChatId, projectId: null })}
                disabled={moveChat.isPending}
                className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-muted hover:bg-surface hover:text-white transition-colors flex items-center gap-2"
              >
                <MessageSquare size={13} className="shrink-0" />
                Черновики (без проекта)
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => moveChat.mutate({ id: moveChatId, projectId: p.id })}
                  disabled={moveChat.isPending}
                  className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-[#c9d1d9] hover:bg-surface hover:text-white transition-colors flex items-center gap-2"
                >
                  <FolderOpen size={13} className="shrink-0 text-muted" />
                  {p.name}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setMoveChatId(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ProjectRow ─────────────────────────────────────────────────────────────

function ProjectRow({
  project, isExpanded, hasActiveChild, isDragTarget, isActiveProject,
  onToggle, onSelect, onDelete, onRename, onDragOver, onDrop, onDragLeave,
}: {
  project: Project;
  isExpanded: boolean;
  hasActiveChild: boolean;
  isDragTarget: boolean;
  isActiveProject: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onRename: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragLeave: () => void;
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
      className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-all border-l-[2px] ${
        isDragTarget
          ? "bg-accent/10 border-l-accent"
          : isActiveProject || hasActiveChild
          ? "bg-accent/5 border-l-accent/60"
          : "border-l-transparent hover:bg-[#1c2128]"
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      {/* Expand/collapse arrow */}
      <button
        onClick={onToggle}
        className="p-0.5 rounded text-muted hover:text-white transition-colors shrink-0"
      >
        <ChevronRight
          size={12}
          className={`transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Folder icon + name */}
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
      >
        {isExpanded
          ? <FolderOpen size={13} className={hasActiveChild ? "text-accent" : "text-muted"} />
          : <FolderOpen size={13} className={hasActiveChild ? "text-accent" : "text-muted"} />
        }
        <span className={`text-[12px] font-medium truncate ${
          isActiveProject || hasActiveChild ? "text-white" : "text-[#c9d1d9]"
        }`}>
          {project.name}
        </span>
      </button>

      {/* ... menu */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className={`p-0.5 rounded text-muted hover:text-white transition-all ${
            menuOpen ? "opacity-100 text-white" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <MoreHorizontal size={13} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-[160px] bg-[#161b22] border border-border rounded-lg shadow-xl overflow-hidden">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRename(); }}
              className="w-full text-left px-3 py-2 text-[12px] text-[#c9d1d9] hover:bg-[#21262d] hover:text-white transition-colors"
            >
              Переименовать
            </button>
            <div className="border-t border-border" />
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
              className="w-full text-left px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Удалить проект
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ChatRow ────────────────────────────────────────────────────────────────

function ChatRow({
  chat, isActive, onSelect, onDelete, onRename, onMoveToProject, onDragStart, onDragEnd,
}: {
  chat: Chat;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: () => void;
  onMoveToProject: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
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
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-l-[2px] transition-all ${
        isActive
          ? "border-l-accent bg-[#1c2740]"
          : "border-l-transparent hover:bg-[#1c2128]"
      }`}
    >
      <MessageSquare size={11} className={`shrink-0 ${isActive ? "text-accent" : "text-muted"}`} />
      <div className="min-w-0 flex-1">
        <div className={`text-[12px] font-medium truncate ${isActive ? "text-white" : "text-[#c9d1d9]"}`}>
          {chat.title || "Новый чат"}
        </div>
        <div className="text-[10px] text-muted">{formatDate(chat.created_at)}</div>
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className={`p-0.5 rounded text-muted hover:text-white transition-all ${
            menuOpen ? "opacity-100 text-white" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <MoreHorizontal size={12} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-[160px] bg-[#161b22] border border-border rounded-lg shadow-xl overflow-hidden">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRename(); }}
              className="w-full text-left px-3 py-2 text-[12px] text-[#c9d1d9] hover:bg-[#21262d] hover:text-white transition-colors">
              Переименовать
            </button>
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onMoveToProject(); }}
              className="w-full text-left px-3 py-2 text-[12px] text-[#c9d1d9] hover:bg-[#21262d] hover:text-white transition-colors">
              Перенести в проект
            </button>
            <div className="border-t border-border" />
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
              className="w-full text-left px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors">
              Удалить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
