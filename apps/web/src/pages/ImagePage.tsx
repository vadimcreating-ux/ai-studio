import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  X,
  Paperclip,
  ImageIcon,
  Loader2,
  Trash2,
  RotateCcw,
  Clock,
  Copy,
  Check,
  Wand2,
  Languages,
  FolderOpen,
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react";
import { api } from "../shared/api/client";

const MODELS = [
  { value: "nano-banana-pro", label: "Nano Banana Pro" },
];

const ASPECT_RATIOS = [
  { value: "", label: "Auto" },
  { value: "1:1", label: "1:1" },
  { value: "2:3", label: "2:3" },
  { value: "3:2", label: "3:2" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "21:9", label: "21:9" },
];

const RESOLUTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
];

const OUTPUT_FORMATS = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
];

type GeneratedImage = {
  taskId: string;
  imageUrl: string;
  prompt: string;
};

type FileItem = {
  id: string;
  taskId: string;
  type: "image";
  name: string;
  url: string;
  createdAt: string;
  source: "kie";
  prompt: string | null;
};

type Project = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  style: string;
  memory: string;
  module: string;
};

function pollStatus(taskId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 60;

    const check = async () => {
      attempts++;
      try {
        const data = await api.get<{
          ok: boolean;
          status: string;
          imageUrl: string;
          errorMessage?: string;
        }>(`/api/image/status?taskId=${encodeURIComponent(taskId)}`);

        if (data.status === "SUCCESS" && data.imageUrl) {
          resolve(data.imageUrl);
        } else if (data.status === "GENERATING" && attempts < maxAttempts) {
          setTimeout(check, 3000);
        } else {
          reject(new Error(data.errorMessage || "Генерация не удалась"));
        }
      } catch (e) {
        reject(e);
      }
    };

    setTimeout(check, 3000);
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      title="Копировать URL"
      onClick={() => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  );
}

export default function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("nano-banana-pro");
  const [aspectRatio, setAspectRatio] = useState("");
  const [resolution, setResolution] = useState("1K");
  const [outputFormat, setOutputFormat] = useState("png");
  const [refImages] = useState<string[]>([]);
  const [refImageFiles, setRefImageFiles] = useState<File[]>([]);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [statusText, setStatusText] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<{
    mode: "create" | "edit";
    id?: string;
    name: string;
    description: string;
    system_prompt: string;
    style: string;
    memory: string;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Files / history
  const { data: filesData } = useQuery({
    queryKey: ["files"],
    queryFn: () => api.get<{ ok: boolean; files: FileItem[] }>("/api/files"),
    refetchInterval: 5000,
  });
  const historyItems = filesData?.files ?? [];
  const filteredHistory = historySearch.trim()
    ? historyItems.filter((f) =>
        f.prompt?.toLowerCase().includes(historySearch.toLowerCase())
      )
    : historyItems;

  // Projects
  const { data: projectsData } = useQuery({
    queryKey: ["projects", "image"],
    queryFn: () =>
      api.get<{ ok: boolean; projects: Project[] }>("/api/projects?module=image"),
  });
  const projects = projectsData?.projects ?? [];
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const createProject = useMutation({
    mutationFn: (data: { name: string; description: string; system_prompt: string; style: string; memory: string }) =>
      api.post<{ ok: boolean; project: Project }>("/api/projects", { ...data, module: "image" }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["projects", "image"] });
      setActiveProjectId(res.project.id);
      setProjectForm(null);
    },
  });

  const updateProject = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; description: string; system_prompt: string; style: string; memory: string }) =>
      api.put<{ ok: boolean; project: Project }>(`/api/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", "image"] });
      setProjectForm(null);
    },
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/projects/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["projects", "image"] });
      if (activeProjectId === id) setActiveProjectId(null);
    },
  });

  const deleteFile = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/files/${id}`),
    onSuccess: () => {
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });

  const improvePrompt = useMutation({
    mutationFn: async () => {
      const data = await api.post<{ ok: boolean; improvedPrompt: string }>(
        "/api/image/improve-prompt",
        { prompt }
      );
      return data.improvedPrompt;
    },
    onSuccess: (improved) => setPrompt(improved),
  });

  const translatePrompt = useMutation({
    mutationFn: async () => {
      const data = await api.post<{ ok: boolean; translatedPrompt: string }>(
        "/api/image/translate-prompt",
        { prompt }
      );
      return data.translatedPrompt;
    },
    onSuccess: (translated) => setPrompt(translated),
  });

  const generate = useMutation({
    mutationFn: async () => {
      setStatusText("Создаём задачу...");

      const imageInput = refImages.length > 0 ? refImages : undefined;
      // Combine project style as suffix if active
      const finalPrompt = activeProject?.style
        ? `${prompt}, ${activeProject.style}`
        : prompt;

      const data = await api.post<{ ok: boolean; taskId: string }>(
        "/api/image/generate",
        {
          model,
          prompt: finalPrompt,
          image_input: imageInput,
          aspect_ratio: aspectRatio || undefined,
          resolution,
          output_format: outputFormat,
        }
      );

      setStatusText("Генерация... (обычно 10–30 секунд)");
      const imageUrl = await pollStatus(data.taskId);
      setStatusText("");
      return { taskId: data.taskId, imageUrl, prompt: finalPrompt };
    },
    onSuccess: (result) => {
      setResults((prev) => [result, ...prev]);
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
    onError: () => setStatusText(""),
  });

  const handleFileAdd = (files: FileList | null) => {
    if (!files) return;
    setRefImageFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const removeRefFile = (i: number) => {
    setRefImageFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const downloadImage = (url: string, taskId: string) => {
    const a = document.createElement("a");
    a.href = `/api/image/download?url=${encodeURIComponent(url)}&name=image-${taskId}.${outputFormat}`;
    a.download = `image-${taskId}.${outputFormat}`;
    a.click();
  };

  const openCreateForm = () =>
    setProjectForm({ mode: "create", name: "", description: "", system_prompt: "", style: "", memory: "" });

  const openEditForm = (p: Project) =>
    setProjectForm({ mode: "edit", id: p.id, name: p.name, description: p.description, system_prompt: p.system_prompt, style: p.style, memory: p.memory });

  const submitProjectForm = () => {
    if (!projectForm) return;
    if (projectForm.mode === "create") {
      createProject.mutate({ name: projectForm.name, description: projectForm.description, system_prompt: projectForm.system_prompt, style: projectForm.style, memory: projectForm.memory });
    } else if (projectForm.id) {
      updateProject.mutate({ id: projectForm.id, name: projectForm.name, description: projectForm.description, system_prompt: projectForm.system_prompt, style: projectForm.style, memory: projectForm.memory });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-border shrink-0">
        <h1 className="text-[22px] font-semibold text-white leading-tight">Image</h1>
        <p className="text-[13px] text-muted mt-0.5">Генерация изображений через KIE API</p>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left column: Projects (top) + Settings (bottom) */}
        <div className="w-[280px] min-w-[280px] border-r border-border flex flex-col overflow-hidden">

          {/* Projects — top, scrollable */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <FolderOpen size={14} className="text-muted" />
                <span className="text-[12px] font-semibold text-white uppercase tracking-wider">Проекты</span>
              </div>
              <button
                onClick={openCreateForm}
                className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors"
                title="Создать проект"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3">
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
                  <FolderOpen size={20} className="text-muted/40" />
                  <div className="text-[12px] text-muted/60 leading-snug px-2">
                    Создайте проект со стилем, памятью и шаблонами промптов
                  </div>
                  <button
                    onClick={openCreateForm}
                    className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-accent text-[12px] text-muted hover:text-white transition-colors"
                  >
                    <Plus size={12} />
                    Новый проект
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {projects.map((p) => {
                    const isActive = p.id === activeProjectId;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setActiveProjectId(isActive ? null : p.id)}
                        className={`group flex flex-col gap-1 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                          isActive
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-[#484f58] hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[13px] font-medium truncate ${isActive ? "text-white" : "text-white/80"}`}>
                            {p.name}
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditForm(p); }}
                              className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors"
                              title="Редактировать"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteProject.mutate(p.id); }}
                              className="p-1 rounded hover:bg-white/10 text-muted hover:text-red-400 transition-colors"
                              title="Удалить"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        {p.description && (
                          <p className="text-[11px] text-muted leading-snug line-clamp-2">{p.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {p.style && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-border text-muted truncate max-w-full">
                              {p.style.length > 30 ? p.style.slice(0, 30) + "…" : p.style}
                            </span>
                          )}
                          {p.system_prompt && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                              промпт
                            </span>
                          )}
                          {p.memory && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
                              память
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Settings — bottom, collapsible */}
          <div className="border-t border-border shrink-0">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Настройки генерации</span>
              {settingsOpen ? <ChevronDown size={13} className="text-muted" /> : <ChevronUp size={13} className="text-muted" />}
            </button>

            {settingsOpen && (
              <div className="px-4 pb-4 flex flex-col gap-3">
                {/* Model + Aspect ratio — two compact selects */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Модель</label>
                    <select value={model} onChange={(e) => setModel(e.target.value)} className="input-field text-[12px] py-1.5">
                      {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Соотношение</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="input-field text-[12px] py-1.5">
                      {ASPECT_RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Resolution + Format — two toggle groups */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Разрешение</label>
                    <div className="flex gap-1">
                      {RESOLUTIONS.map((r) => (
                        <button key={r.value} onClick={() => setResolution(r.value)}
                          className={`flex-1 py-1 rounded-md text-[11px] border transition-colors ${resolution === r.value ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-white hover:border-[#484f58]"}`}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Формат</label>
                    <div className="flex gap-1">
                      {OUTPUT_FORMATS.map((f) => (
                        <button key={f.value} onClick={() => setOutputFormat(f.value)}
                          className={`flex-1 py-1 rounded-md text-[11px] border transition-colors ${outputFormat === f.value ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-white hover:border-[#484f58]"}`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ref images */}
                <div>
                  <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Референсы (img2img)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {refImageFiles.map((file, i) => (
                      <div key={i} className="relative group w-12 h-12 rounded-lg overflow-hidden border border-border">
                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt={file.name} />
                        <button onClick={() => removeRefFile(i)}
                          className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={9} className="text-white" />
                        </button>
                      </div>
                    ))}
                    {refImageFiles.length < 8 && (
                      <button onClick={() => fileInputRef.current?.click()}
                        className="w-12 h-12 rounded-lg border border-dashed border-border hover:border-accent flex items-center justify-center text-muted hover:text-white transition-colors">
                        <Paperclip size={13} />
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp"
                    className="hidden" onChange={(e) => handleFileAdd(e.target.files)} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center — gallery + prompt at bottom */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Gallery */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
            {results.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                {generate.isPending ? (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-[#161b22] border border-border flex items-center justify-center">
                      <Loader2 size={24} className="text-muted animate-spin" />
                    </div>
                    <div className="text-[13px] text-muted">{statusText || "Генерация..."}</div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-[#161b22] border border-border flex items-center justify-center">
                      <ImageIcon size={24} className="text-muted" />
                    </div>
                    <div className="text-[13px] text-muted">Результаты появятся здесь</div>
                    <div className="text-[12px] text-muted/60">Введите промпт и нажмите «Сгенерировать»</div>
                  </>
                )}
              </div>
            ) : (
              <div className="columns-2 gap-4 space-y-4">
                {generate.isPending && (
                  <div className="break-inside-avoid aspect-square rounded-xl bg-[#161b22] border border-border flex items-center justify-center">
                    <Loader2 size={32} className="text-muted animate-spin" />
                  </div>
                )}
                {results.map((result) => (
                  <div key={result.taskId}
                    className="break-inside-avoid group relative rounded-xl overflow-hidden border border-border cursor-pointer"
                    onClick={() => setLightboxUrl(result.imageUrl)}>
                    <img src={result.imageUrl} alt={result.prompt} className="w-full block" loading="lazy" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                      <p className="text-[11px] text-white/80 line-clamp-2 leading-snug">{result.prompt}</p>
                      <button onClick={(e) => { e.stopPropagation(); downloadImage(result.imageUrl, result.taskId); }}
                        className="flex items-center gap-1.5 self-end px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12px] transition-colors">
                        <Download size={13} />Скачать
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prompt panel — pinned to bottom */}
          <div className="border-t border-border px-5 py-4 shrink-0">
            {/* Active project badge */}
            {activeProject && (
              <div className="flex items-center gap-2 mb-2 px-0.5">
                <FolderOpen size={12} className="text-accent" />
                <span className="text-[11px] text-accent font-medium">{activeProject.name}</span>
                {activeProject.style && (
                  <span className="text-[11px] text-muted truncate">· {activeProject.style.length > 40 ? activeProject.style.slice(0, 40) + "…" : activeProject.style}</span>
                )}
              </div>
            )}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={activeProject?.system_prompt ? activeProject.system_prompt : "Описание изображения..."}
              rows={5}
              className="input-field resize-none scrollbar-thin w-full"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => improvePrompt.mutate()}
                  disabled={!prompt.trim() || improvePrompt.isPending || translatePrompt.isPending}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all disabled:cursor-not-allowed ${
                    improvePrompt.isPending
                      ? "border-green-500 text-green-400 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                      : "border-border text-muted hover:text-white hover:border-[#484f58] disabled:opacity-40"
                  }`}
                >
                  {improvePrompt.isPending ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                  {improvePrompt.isPending ? "Улучшаем..." : "Улучшить"}
                </button>
                <button
                  onClick={() => translatePrompt.mutate()}
                  disabled={!prompt.trim() || translatePrompt.isPending || improvePrompt.isPending}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all disabled:cursor-not-allowed ${
                    translatePrompt.isPending
                      ? "border-green-500 text-green-400 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                      : "border-border text-muted hover:text-white hover:border-[#484f58] disabled:opacity-40"
                  }`}
                >
                  {translatePrompt.isPending ? <Loader2 size={11} className="animate-spin" /> : <Languages size={11} />}
                  {translatePrompt.isPending ? "Переводим..." : "Перевести"}
                </button>
                <span className="text-[11px] text-muted ml-1">{prompt.length} / 20000</span>
              </div>
              <button
                onClick={() => generate.mutate()}
                disabled={!prompt.trim() || generate.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generate.isPending
                  ? <><Loader2 size={14} className="animate-spin" />Генерация...</>
                  : <><ImageIcon size={14} />Сгенерировать</>}
              </button>
            </div>
            {(generate.isError || improvePrompt.isError || translatePrompt.isError) && (
              <div className="text-[11px] text-red-400 mt-1.5">
                {generate.error?.message ?? improvePrompt.error?.message ?? translatePrompt.error?.message ?? "Ошибка"}
              </div>
            )}
            {statusText && !generate.isError && (
              <div className="text-[11px] text-muted mt-1.5 animate-pulse">{statusText}</div>
            )}
          </div>
        </div>

        {/* Right — history */}
        <div className="w-[280px] min-w-[280px] border-l border-border flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-muted" />
                <span className="text-[13px] font-semibold text-white">История</span>
              </div>
              {historyItems.length > 0 && (
                <span className="text-[11px] text-muted bg-[#161b22] border border-border px-1.5 py-0.5 rounded-full">
                  {historyItems.length}
                </span>
              )}
            </div>
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Поиск по промпту..."
              className="input-field text-[12px] py-1.5"
            />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                <ImageIcon size={20} className="text-muted/40" />
                <div className="text-[12px] text-muted/60">
                  {historySearch ? "Ничего не найдено" : "История пуста"}
                </div>
              </div>
            ) : (
              filteredHistory.map((file) => (
                <HistoryItem
                  key={file.id}
                  file={file}
                  onUsePrompt={(p) => setPrompt(p)}
                  onDownload={() => downloadImage(file.url, file.taskId)}
                  onDelete={() => setDeleteConfirm(file.id)}
                  onOpen={() => setLightboxUrl(file.url)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Project form modal */}
      {projectForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setProjectForm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl w-[480px] flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-white">
                {projectForm.mode === "create" ? "Новый проект" : "Редактировать проект"}
              </h3>
              <button onClick={() => setProjectForm(null)} className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 flex flex-col gap-4">
              <FormField label="Название *">
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm((f) => f && { ...f, name: e.target.value })}
                  placeholder="Например: Предметная съёмка"
                  className="input-field"
                />
              </FormField>
              <FormField label="Описание">
                <input
                  type="text"
                  value={projectForm.description}
                  onChange={(e) => setProjectForm((f) => f && { ...f, description: e.target.value })}
                  placeholder="Короткое описание сценария"
                  className="input-field"
                />
              </FormField>
              <FormField label="Шаблон промпта" hint="Используется как placeholder в поле ввода при выборе проекта">
                <textarea
                  value={projectForm.system_prompt}
                  onChange={(e) => setProjectForm((f) => f && { ...f, system_prompt: e.target.value })}
                  placeholder="Например: A studio photo of {subject} on white background..."
                  rows={3}
                  className="input-field resize-none scrollbar-thin"
                />
              </FormField>
              <FormField label="Стиль" hint="Автоматически добавляется к промпту при генерации">
                <input
                  type="text"
                  value={projectForm.style}
                  onChange={(e) => setProjectForm((f) => f && { ...f, style: e.target.value })}
                  placeholder="Например: photorealistic, soft lighting, 8K"
                  className="input-field"
                />
              </FormField>
              <FormField label="Память / заметки" hint="Контекст и важные детали для этого проекта">
                <textarea
                  value={projectForm.memory}
                  onChange={(e) => setProjectForm((f) => f && { ...f, memory: e.target.value })}
                  placeholder="Бренд-гайдлайны, предпочтения, цветовая палитра..."
                  rows={3}
                  className="input-field resize-none scrollbar-thin"
                />
              </FormField>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button onClick={() => setProjectForm(null)} className="px-4 py-2 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">
                Отмена
              </button>
              <button
                onClick={submitProjectForm}
                disabled={!projectForm.name.trim() || createProject.isPending || updateProject.isPending}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {createProject.isPending || updateProject.isPending ? "Сохраняем..." : projectForm.mode === "create" ? "Создать" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete file confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[300px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Удалить изображение?</div>
            <div className="text-[13px] text-muted">Это действие нельзя отменить.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
              <button onClick={() => deleteFile.mutate(deleteConfirm)} disabled={deleteFile.isPending}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-[13px] text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                {deleteFile.isPending ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxUrl} className="max-w-full max-h-[85vh] rounded-xl object-contain" alt="" />
            <button onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-[#161b22] border border-border rounded-full flex items-center justify-center text-muted hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryItem({
  file, onUsePrompt, onDownload, onDelete, onOpen,
}: {
  file: FileItem;
  onUsePrompt: (p: string) => void;
  onDownload: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="group flex gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
      <div className="w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0 cursor-pointer hover:border-accent transition-colors" onClick={onOpen}>
        <img src={file.url} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <p className="text-[12px] text-white/80 leading-snug line-clamp-2 cursor-pointer hover:text-white transition-colors" title={file.prompt ?? ""} onClick={onOpen}>
            {file.prompt || <span className="text-muted italic">без промпта</span>}
          </p>
          <p className="text-[10px] text-muted mt-0.5">{formatDate(file.createdAt)}</p>
        </div>
        <div className="flex items-center gap-0.5 mt-1">
          {file.prompt && (
            <button title="Использовать промпт" onClick={() => onUsePrompt(file.prompt!)}
              className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors">
              <RotateCcw size={12} />
            </button>
          )}
          <CopyUrlButton url={file.url} />
          <button title="Скачать" onClick={onDownload} className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors">
            <Download size={12} />
          </button>
          <button title="Удалить" onClick={onDelete} className="p-1 rounded hover:bg-white/10 text-muted hover:text-red-400 transition-colors ml-auto">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-white uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-white mb-1">{label}</label>
      {hint && <p className="text-[11px] text-muted mb-1.5 leading-snug">{hint}</p>}
      {children}
    </div>
  );
}
