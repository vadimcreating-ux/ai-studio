import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { projectsApi, type Project } from "../../shared/api/projects";
import { chatApi, type Chat } from "../../shared/api/chat";
import { formatDate } from "../../shared/utils/date";

type Props = {
  engine: string;
  engineLabel: string;
  engineDescription: string;
  selectedProjectId: string | null;
  selectedChatId: string | null;
  onSelectProject: (id: string | null) => void;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  defaultModel: string;
};

export default function ProjectsPanel({
  engine, engineLabel, engineDescription,
  selectedProjectId, selectedChatId,
  onSelectProject, onSelectChat, onNewChat, defaultModel,
}: Props) {
  const qc = useQueryClient();
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);

  const { data: projectsData } = useQuery({
    queryKey: ["projects", engine],
    queryFn: () => projectsApi.list(engine),
  });

  const { data: chatsData } = useQuery({
    queryKey: ["chats", engine, selectedProjectId],
    queryFn: () => chatApi.list(engine, selectedProjectId ?? undefined),
  });

  const createProject = useMutation({
    mutationFn: (name: string) => projectsApi.create({ module: engine, name }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["projects", engine] });
      onSelectProject(data.project.id);
      setNewProjectName("");
      setShowNewProject(false);
    },
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["projects", engine] });
      if (selectedProjectId === id) onSelectProject(null);
    },
  });

  const createChat = useMutation({
    mutationFn: () => chatApi.create({ module: engine, model: defaultModel, project_id: selectedProjectId ?? undefined }),
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
    },
  });

  const projects = projectsData?.projects ?? [];
  const chats = chatsData?.chats ?? [];

  return (
    <div className="flex flex-col w-[280px] min-w-[280px] h-full bg-panel border-r border-border overflow-y-auto scrollbar-thin">
      {/* Projects header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[15px] font-semibold text-white">Проекты</span>
          <button
            onClick={() => setShowNewProject(true)}
            className="text-[12px] px-2.5 py-0.5 rounded bg-surface hover:bg-border text-[#c9d1d9] transition-colors"
          >
            Новый
          </button>
        </div>
        <p className="text-[12px] text-muted leading-snug">
          Отдельные проекты {engineLabel} с собственной историей и памятью.
        </p>
      </div>

      {/* New project input */}
      {showNewProject && (
        <div className="px-4 py-3 border-b border-border bg-[#1c2128]">
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
            className="w-full bg-base border border-border rounded px-2.5 py-1.5 text-[13px] text-white placeholder:text-muted outline-none focus:border-accent"
          />
          <div className="flex gap-2 mt-2">
            <button
              disabled={!newProjectName.trim()}
              onClick={() => newProjectName.trim() && createProject.mutate(newProjectName.trim())}
              className="flex-1 text-[12px] py-1 rounded bg-accent hover:bg-accent-hover text-white disabled:opacity-40"
            >
              Создать
            </button>
            <button
              onClick={() => { setShowNewProject(false); setNewProjectName(""); }}
              className="flex-1 text-[12px] py-1 rounded bg-surface hover:bg-border text-[#8b949e]"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Projects list */}
      <div>
        {projects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            isActive={selectedProjectId === project.id}
            onClick={() => onSelectProject(selectedProjectId === project.id ? null : project.id)}
            onDelete={() => deleteProject.mutate(project.id)}
          />
        ))}
        {projects.length === 0 && !showNewProject && (
          <p className="px-4 py-3 text-[12px] text-muted">Нет проектов. Создайте первый.</p>
        )}
      </div>

      {/* Dialogs header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between border-t border-border mt-1">
        <span className="text-[14px] font-semibold text-white">Диалоги</span>
        <button
          onClick={() => createChat.mutate()}
          className="text-[12px] px-2.5 py-0.5 rounded bg-surface hover:bg-border text-[#c9d1d9] transition-colors"
        >
          Чат
        </button>
      </div>

      {/* Chats list */}
      <div className="flex-1">
        {chats.map((chat) => (
          <ChatItem
            key={chat.id}
            chat={chat}
            isActive={selectedChatId === chat.id}
            onClick={() => onSelectChat(chat)}
            onDelete={() => deleteChat.mutate(chat.id)}
          />
        ))}
        {chats.length === 0 && (
          <p className="px-4 py-2 text-[12px] text-muted leading-snug">
            {selectedProjectId ? "Нет диалогов в этом проекте." : "Нет диалогов. Нажмите «Чат»."}
          </p>
        )}
        {chats.length === 0 && (
          <p className="px-4 mt-2 text-[11px] text-muted/60 leading-snug">
            Позже здесь появится поиск, фильтрация и архив диалогов.
          </p>
        )}
      </div>
    </div>
  );
}

function ProjectItem({
  project, isActive, onClick, onDelete,
}: {
  project: Project; isActive: boolean; onClick: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative px-4 py-3 cursor-pointer border-l-[3px] transition-all ${
        isActive
          ? "border-accent bg-[#1c2740]"
          : "border-transparent hover:bg-[#1c2128]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[13px] font-semibold truncate ${isActive ? "text-white" : "text-[#c9d1d9]"}`}>
            {project.name}
          </div>
          {project.description && (
            <div className="text-[11px] text-muted mt-0.5 leading-snug line-clamp-2">
              {project.description}
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 rounded hover:text-red-400 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function ChatItem({
  chat, isActive, onClick, onDelete,
}: {
  chat: Chat; isActive: boolean; onClick: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group px-4 py-3 cursor-pointer border-l-[3px] transition-all ${
        isActive
          ? "border-accent bg-[#1c2740]"
          : "border-transparent hover:bg-[#1c2128]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[13px] font-semibold truncate ${isActive ? "text-white" : "text-[#c9d1d9]"}`}>
            {chat.title}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            Последнее сообщение: {formatDate(chat.created_at)}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 rounded hover:text-red-400 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
