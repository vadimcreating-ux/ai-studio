import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, HelpCircle, Search } from "lucide-react";
import { projectsApi, type Project } from "../../shared/api/projects";

type Props = {
  engine: string;
  engineLabel: string;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
};

export default function ProjectsPanel({ engine, engineLabel, selectedProjectId, onSelectProject }: Props) {
  const qc = useQueryClient();
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: projectsData } = useQuery({
    queryKey: ["projects", engine],
    queryFn: () => projectsApi.list(engine),
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
      setDeleteProjectConfirm(null);
    },
  });

  const allProjects = projectsData?.projects ?? [];
  const projects = search.trim()
    ? allProjects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : allProjects;

  return (
    <div className="flex flex-col w-[240px] min-w-[240px] h-full bg-panel border-r border-border overflow-hidden">
      {/* Projects block */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-white">Проекты</span>
            <span
              title={`Отдельные проекты ${engineLabel} с собственной историей и памятью.`}
              className="text-muted hover:text-white cursor-help transition-colors"
            >
              <HelpCircle size={12} />
            </span>
          </div>
          <button
            onClick={() => setShowNewProject(true)}
            className="text-[11px] px-2 py-0.5 rounded bg-surface hover:bg-border text-[#c9d1d9] transition-colors"
          >
            Новый
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#1c2128] border border-border focus-within:border-accent transition-colors">
            <Search size={11} className="text-muted shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск проектов..."
              className="flex-1 bg-transparent text-[12px] text-white placeholder:text-muted outline-none"
            />
          </div>
        </div>

        {/* New project input */}
        {showNewProject && (
          <div className="px-3 py-2.5 border-b border-border bg-[#1c2128] shrink-0">
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
              className="w-full bg-base border border-border rounded px-2.5 py-1.5 text-[12px] text-white placeholder:text-muted outline-none focus:border-accent"
            />
            <div className="flex gap-2 mt-2">
              <button
                disabled={!newProjectName.trim()}
                onClick={() => newProjectName.trim() && createProject.mutate(newProjectName.trim())}
                className="flex-1 text-[11px] py-1 rounded bg-accent hover:bg-accent-hover text-white disabled:opacity-40"
              >
                Создать
              </button>
              <button
                onClick={() => { setShowNewProject(false); setNewProjectName(""); }}
                className="flex-1 text-[11px] py-1 rounded bg-surface hover:bg-border text-[#8b949e]"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Projects list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              isActive={selectedProjectId === project.id}
              onClick={() => onSelectProject(selectedProjectId === project.id ? null : project.id)}
              onDelete={() => setDeleteProjectConfirm(project.id)}
            />
          ))}
          {projects.length === 0 && !showNewProject && (
            <p className="px-3 py-3 text-[12px] text-muted">Нет проектов. Создайте первый.</p>
          )}
        </div>
      </div>

      {/* Delete project confirmation */}
      {deleteProjectConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteProjectConfirm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[300px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Удалить проект?</div>
            <div className="text-[13px] text-muted">Это действие нельзя отменить.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteProjectConfirm(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
              <button onClick={() => deleteProject.mutate(deleteProjectConfirm)} disabled={deleteProject.isPending}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-[13px] text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                {deleteProject.isPending ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectItem({ project, isActive, onClick, onDelete }: {
  project: Project; isActive: boolean; onClick: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative px-3 py-2.5 cursor-pointer border-l-[3px] transition-all ${
        isActive ? "border-accent bg-[#1c2740]" : "border-transparent hover:bg-[#1c2128]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[13px] font-semibold truncate ${isActive ? "text-white" : "text-[#c9d1d9]"}`}>
            {project.name}
          </div>
          {project.description && (
            <div className="text-[11px] text-muted mt-0.5 leading-snug line-clamp-2">{project.description}</div>
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
