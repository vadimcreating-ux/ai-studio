import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download, X, Paperclip, Loader2, Trash2, Clock, Copy, Check,
  Wand2, Languages, Film, Play, FolderOpen, Plus, Pencil,
} from "lucide-react";
import { api } from "../shared/api/client";

// ─── Models ──────────────────────────────────────────────────────────────────

type VideoModel = {
  value: string;
  label: string;
  tag: string;
  needsImage: boolean;
  cost: number;
};

const VIDEO_MODELS: VideoModel[] = [
  { value: "sora-2-pro-image-to-video", label: "Sora-2-Pro", tag: "img→video", needsImage: true,  cost: 200 },
  { value: "sora-2-pro-text-to-video",  label: "Sora-2-Pro", tag: "text→video", needsImage: false, cost: 150 },
  { value: "sora-2-image-to-video",     label: "Sora-2",     tag: "img→video", needsImage: true,  cost: 100 },
  { value: "sora-2-text-to-video",      label: "Sora-2",     tag: "text→video", needsImage: false, cost: 50  },
];

const ASPECT_RATIOS = [
  { value: "", label: "Auto" },
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

const N_FRAMES_OPTIONS = [
  { value: "10", label: "10s" },
  { value: "15", label: "15s" },
];

const SIZE_OPTIONS = [
  { value: "standard", label: "Std" },
  { value: "high", label: "High" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type GeneratedVideo = { taskId: string; videoUrl: string; prompt: string };

type VideoHistoryItem = {
  id: string; taskId: string; type: "video";
  name: string; url: string; createdAt: string;
  source: "kie"; prompt: string | null;
};

type Project = {
  id: string; name: string; description: string;
  system_prompt: string; style: string; memory: string; module: string;
};

// ─── RotateCcw micro icon ────────────────────────────────────────────────────

function RotateCcwIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

// ─── History item ────────────────────────────────────────────────────────────

function HistoryItem({
  file, onUsePrompt, onDownload, onDelete, onOpen,
}: {
  file: VideoHistoryItem;
  onUsePrompt: (p: string) => void;
  onDownload: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!file.prompt) return;
    navigator.clipboard.writeText(file.prompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group px-3 py-2.5 hover:bg-white/[0.03] transition-colors cursor-pointer border-b border-border/40 last:border-0">
      <div className="flex gap-2">
        <div
          className="w-10 h-10 rounded-lg overflow-hidden border border-border shrink-0 bg-[#161b22] flex items-center justify-center cursor-pointer relative"
          onClick={onOpen}
        >
          <video src={file.url} className="w-full h-full object-cover" muted />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={12} className="text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-white/70 leading-snug line-clamp-2 mb-1">{file.prompt || file.name}</p>
          <div className="text-[10px] text-muted/60">
            {new Date(file.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
      <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {file.prompt && (
          <>
            <button onClick={(e) => { e.stopPropagation(); onUsePrompt(file.prompt!); }} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted hover:text-white hover:bg-white/10 transition-colors">
              <RotateCcwIcon /> Использовать
            </button>
            <button onClick={copyPrompt} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted hover:text-white hover:bg-white/10 transition-colors">
              {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
            </button>
          </>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted hover:text-white hover:bg-white/10 transition-colors ml-auto">
          <Download size={10} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

// ─── Video lightbox ──────────────────────────────────────────────────────────

function VideoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <video src={url} controls autoPlay className="max-w-full max-h-[85vh] rounded-xl" />
        <button onClick={onClose} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── FormField helper ────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-white/80">{label}</label>
      {children}
    </div>
  );
}

// ─── Main VideoPage ───────────────────────────────────────────────────────────

export default function VideoPage() {
  const queryClient = useQueryClient();

  // Model & settings
  const [modelValue, setModelValue] = useState("sora-2-pro-image-to-video");
  const activeModel = VIDEO_MODELS.find((m) => m.value === modelValue) ?? VIDEO_MODELS[0];
  const [aspectRatio, setAspectRatio] = useState("");
  const [nFrames, setNFrames] = useState("10");
  const [size, setSize] = useState("standard");
  const [removeWatermark, setRemoveWatermark] = useState(true);

  // Prompt & project
  const [prompt, setPrompt] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Ref image (first frame for img→video)
  const [refImageFiles, setRefImageFiles] = useState<File[]>([]);
  const [refImageUrls, setRefImageUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [results, setResults] = useState<GeneratedVideo[]>([]);
  const [statusText, setStatusText] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<{
    mode: "create" | "edit"; id?: string;
    name: string; system_prompt: string; style: string; memory: string;
  } | null>(null);

  // When switching models reset image if new model doesn't need it
  const handleModelChange = (v: string) => {
    setModelValue(v);
    const m = VIDEO_MODELS.find((x) => x.value === v);
    if (m && !m.needsImage) {
      setRefImageFiles([]);
      setRefImageUrls([]);
    }
  };

  // Ref image upload
  const handleRefFileAdd = async (files: FileList | null) => {
    if (!files) return;
    const file = files[0];
    if (!file) return;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setRefImageFiles([file]);
    setRefImageUrls([url]);
  };
  const removeRefFile = () => { setRefImageFiles([]); setRefImageUrls([]); };

  // Projects
  const { data: projectsData } = useQuery({
    queryKey: ["projects", "video"],
    queryFn: () => api.get<{ ok: boolean; projects: Project[] }>("/api/projects?module=video"),
  });
  const projects = projectsData?.projects ?? [];
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const createProject = useMutation({
    mutationFn: (d: Omit<Project, "id" | "module">) =>
      api.post<{ ok: boolean; project: Project }>("/api/projects", { ...d, module: "video" }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["projects", "video"] });
      setActiveProjectId(res.project.id);
      setProjectForm(null);
    },
  });

  const updateProject = useMutation({
    mutationFn: ({ id, ...d }: Omit<Project, "module">) =>
      api.put<{ ok: boolean; project: Project }>(`/api/projects/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projects", "video"] }); setProjectForm(null); },
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/projects/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["projects", "video"] });
      if (activeProjectId === id) setActiveProjectId(null);
      setDeleteProjectConfirm(null);
    },
  });

  const openCreateForm = () => setProjectForm({ mode: "create", name: "", system_prompt: "", style: "", memory: "" });
  const openEditForm = (p: Project) => setProjectForm({ mode: "edit", id: p.id, name: p.name, system_prompt: p.system_prompt, style: p.style, memory: p.memory });
  const submitProjectForm = () => {
    if (!projectForm) return;
    const d = { name: projectForm.name, description: "", system_prompt: projectForm.system_prompt, style: projectForm.style, memory: projectForm.memory, context_files: [] };
    if (projectForm.mode === "create") createProject.mutate(d);
    else if (projectForm.id) updateProject.mutate({ id: projectForm.id, ...d });
  };

  // History
  const { data: historyData } = useQuery({
    queryKey: ["video-history"],
    queryFn: () => api.get<{ ok: boolean; files: VideoHistoryItem[] }>("/api/video/history"),
    refetchInterval: 30_000,
  });
  const historyItems = historyData?.files ?? [];
  const filteredHistory = historySearch
    ? historyItems.filter((f) => (f.prompt || f.name).toLowerCase().includes(historySearch.toLowerCase()))
    : historyItems;

  const deleteVideo = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/video/history/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["video-history"] }); setDeleteConfirm(null); },
  });

  // Prompt tools
  const improvePrompt = useMutation({
    mutationFn: (p: string) => api.post<{ ok: boolean; improvedPrompt: string }>("/api/video/improve-prompt", { prompt: p }),
    onSuccess: (data) => setPrompt(data.improvedPrompt),
  });
  const translatePrompt = useMutation({
    mutationFn: (p: string) => api.post<{ ok: boolean; translatedPrompt: string }>("/api/video/translate-prompt", { prompt: p }),
    onSuccess: (data) => setPrompt(data.translatedPrompt),
  });

  // Generate
  const generate = useMutation({
    mutationFn: async () => {
      setStatusText("Создание задачи...");
      const finalPrompt = activeProject?.style ? `${prompt}, ${activeProject.style}` : prompt;

      const { taskId } = await api.post<{ ok: boolean; taskId: string }>("/api/video/generate", {
        model: modelValue,
        prompt: finalPrompt,
        image_urls: activeModel.needsImage && refImageUrls.length ? refImageUrls : undefined,
        aspect_ratio: aspectRatio || undefined,
        n_frames: nFrames,
        size,
        remove_watermark: removeWatermark,
      });

      let attempts = 0;
      while (attempts < 180) {
        await new Promise((r) => setTimeout(r, 3000));
        attempts++;
        const status = await api.get<{ ok: boolean; status: string; videoUrl: string; progress: number; errorMessage: string }>(
          `/api/video/status?taskId=${encodeURIComponent(taskId)}`
        );
        setStatusText(status.progress > 0 ? `Генерация... ${status.progress}%` : `Генерация (${activeModel.label})...`);
        if (status.status === "SUCCESS" && status.videoUrl) return { taskId, videoUrl: status.videoUrl, prompt: finalPrompt };
        if (status.status === "FAILED") throw new Error(status.errorMessage || "Генерация завершилась с ошибкой");
      }
      throw new Error("Таймаут: видео генерируется слишком долго");
    },
    onSuccess: (result) => {
      setResults((prev) => [result, ...prev]);
      setStatusText("");
      queryClient.invalidateQueries({ queryKey: ["video-history"] });
    },
    onError: () => setStatusText(""),
  });

  const downloadVideo = (url: string, taskId: string) => {
    const a = document.createElement("a");
    a.href = `/api/video/download?url=${encodeURIComponent(url)}&name=video-${taskId}.mp4`;
    a.download = `video-${taskId}.mp4`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden">

        {/* Left + Center */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left column */}
          <div className="w-[260px] min-w-[260px] border-r border-border flex flex-col overflow-hidden">

            {/* Projects — scrollable top area */}
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <FolderOpen size={14} className="text-muted" />
                  <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Проекты</span>
                </div>
                <button onClick={openCreateForm} className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors" title="Создать проект">
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3">
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
                    <FolderOpen size={20} className="text-muted/40" />
                    <div className="text-[12px] text-muted/60 leading-snug px-2">Создайте проект со стилем и памятью</div>
                    <button onClick={openCreateForm} className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-accent text-[12px] text-muted hover:text-white transition-colors">
                      <Plus size={12} />Новый проект
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {projects.map((p) => {
                      const isActive = p.id === activeProjectId;
                      return (
                        <div key={p.id} onClick={() => setActiveProjectId(isActive ? null : p.id)}
                          className={`group flex flex-col gap-1 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${isActive ? "border-accent bg-accent/10" : "border-border hover:border-[#484f58] hover:bg-white/[0.02]"}`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-[13px] font-medium truncate ${isActive ? "text-white" : "text-white/80"}`}>{p.name}</span>
                            <div className="flex items-center gap-0.5 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); openEditForm(p); }} className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors"><Pencil size={11} /></button>
                              <button onClick={(e) => { e.stopPropagation(); setDeleteProjectConfirm(p.id); }} className="p-1 rounded hover:bg-white/10 text-muted hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
                            </div>
                          </div>
                          {p.description && <p className="text-[11px] text-muted leading-snug line-clamp-2">{p.description}</p>}
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {p.style && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-border text-muted truncate max-w-full">{p.style.length > 28 ? p.style.slice(0, 28) + "…" : p.style}</span>}
                            {p.memory && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">память</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Model selector — above settings */}
            <div className="shrink-0 px-4 pt-3 pb-2">
              <label className="block text-[10px] text-muted mb-1">Модель</label>
              <select
                value={modelValue}
                onChange={(e) => handleModelChange(e.target.value)}
                className="input-field text-[11px] py-1 w-full"
              >
                {VIDEO_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label} ({m.tag})</option>
                ))}
              </select>
            </div>

            {/* Settings — pinned to bottom, dynamic per model */}
            <div className="shrink-0 px-4 pt-1 pb-4 flex flex-col gap-2.5">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Настройки</span>

              {/* Aspect ratio + Duration */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted mb-1">Формат</label>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="input-field text-[11px] py-1 w-full">
                    {ASPECT_RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted mb-1">Длина</label>
                  <div className="flex gap-1">
                    {N_FRAMES_OPTIONS.map((f) => (
                      <button key={f.value} onClick={() => setNFrames(f.value)}
                        className={`flex-1 py-0.5 rounded text-[11px] border transition-colors ${nFrames === f.value ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-white hover:border-[#484f58]"}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quality + Watermark */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted mb-1">Качество</label>
                  <div className="flex gap-1">
                    {SIZE_OPTIONS.map((s) => (
                      <button key={s.value} onClick={() => setSize(s.value)}
                        className={`flex-1 py-0.5 rounded text-[11px] border transition-colors ${size === s.value ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-white hover:border-[#484f58]"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-muted mb-1">Вотермарк</label>
                  <button onClick={() => setRemoveWatermark((v) => !v)}
                    className={`w-full py-0.5 rounded text-[11px] border transition-colors ${removeWatermark ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-white hover:border-[#484f58]"}`}>
                    {removeWatermark ? "Убрать" : "Оставить"}
                  </button>
                </div>
              </div>

              {/* First frame — only for img→video models */}
              {activeModel.needsImage && (
                <div>
                  <label className="block text-[10px] text-muted mb-1.5">Первый кадр (img→video)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {refImageFiles.length > 0 ? (
                      <div className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={URL.createObjectURL(refImageFiles[0])} className="w-full h-full object-cover" alt="ref" />
                        <button onClick={removeRefFile} className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-lg border border-dashed border-border hover:border-accent flex items-center justify-center text-muted hover:text-white transition-colors">
                        <Paperclip size={16} />
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleRefFileAdd(e.target.files)} />
                </div>
              )}
            </div>
          </div>

          {/* Center: gallery + prompt */}
          <div className="flex flex-col flex-1 overflow-hidden">

            {/* Gallery */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
              {results.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  {generate.isPending ? (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-[#161b22] border border-border flex items-center justify-center">
                        <Loader2 size={24} className="text-muted animate-spin" />
                      </div>
                      <div className="text-[13px] text-muted">{statusText || "Генерация видео..."}</div>
                      <div className="text-[12px] text-muted/60">{activeModel.label} занимает 2–5 минут</div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-[#161b22] border border-border flex items-center justify-center">
                        <Film size={24} className="text-muted" />
                      </div>
                      <div className="text-[13px] text-muted">Результаты появятся здесь</div>
                      <div className="text-[12px] text-muted/60">
                        {activeModel.needsImage ? "Загрузи первый кадр и введи описание" : "Введи описание и нажми «Сгенерировать»"}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="columns-2 gap-4 space-y-4">
                  {generate.isPending && (
                    <div className="break-inside-avoid aspect-video rounded-xl bg-[#161b22] border border-border flex flex-col items-center justify-center gap-2">
                      <Loader2 size={32} className="text-muted animate-spin" />
                      <div className="text-[12px] text-muted">{statusText || "Генерация..."}</div>
                    </div>
                  )}
                  {results.map((result) => (
                    <div key={result.taskId}
                      className="break-inside-avoid group relative rounded-xl overflow-hidden border border-border cursor-pointer"
                      onClick={() => setLightboxUrl(result.videoUrl)}>
                      <video src={result.videoUrl} className="w-full block" muted loop
                        onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                        onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                        <p className="text-[11px] text-white/80 line-clamp-2 leading-snug">{result.prompt}</p>
                        <button onClick={(e) => { e.stopPropagation(); downloadVideo(result.videoUrl, result.taskId); }}
                          className="flex items-center gap-1.5 self-end px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12px] transition-colors">
                          <Download size={13} /> Скачать
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active project banner */}
            {activeProject && (
              <div className="shrink-0 mx-5 mb-0 mt-2 flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30">
                <FolderOpen size={16} className="text-accent shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-accent/70 uppercase tracking-wider font-medium">Активный проект</div>
                  <div className="text-[15px] text-accent font-semibold truncate leading-tight">{activeProject.name}</div>
                  {activeProject.style && <div className="text-[11px] text-muted truncate mt-0.5">{activeProject.style.length > 60 ? activeProject.style.slice(0, 60) + "…" : activeProject.style}</div>}
                </div>
              </div>
            )}

            {/* Prompt bar */}
            <div className="shrink-0 px-5 pt-3 pb-4 flex flex-col gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeProject?.system_prompt || "Описание видео... (движение камеры, сцена, динамика)"}
                rows={3}
                maxLength={10000}
                className="input-field resize-none text-[13px] leading-relaxed"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => improvePrompt.mutate(prompt)}
                    disabled={!prompt.trim() || improvePrompt.isPending || translatePrompt.isPending}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all disabled:cursor-not-allowed ${improvePrompt.isPending ? "border-green-500 text-green-400 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "border-border text-muted hover:text-white hover:border-[#484f58] disabled:opacity-40"}`}>
                    {improvePrompt.isPending ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                    {improvePrompt.isPending ? "Улучшаем..." : "Улучшить"}
                  </button>
                  <button onClick={() => translatePrompt.mutate(prompt)}
                    disabled={!prompt.trim() || translatePrompt.isPending || improvePrompt.isPending}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all disabled:cursor-not-allowed ${translatePrompt.isPending ? "border-green-500 text-green-400 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "border-border text-muted hover:text-white hover:border-[#484f58] disabled:opacity-40"}`}>
                    {translatePrompt.isPending ? <Loader2 size={11} className="animate-spin" /> : <Languages size={11} />}
                    {translatePrompt.isPending ? "Переводим..." : "Перевести"}
                  </button>
                  <span className="text-[11px] text-muted ml-1">{prompt.length} / 10000</span>
                  {statusText && <span className="text-[11px] text-muted animate-pulse ml-2">{statusText}</span>}
                  {generate.isError && <span className="text-[11px] text-red-400 ml-2">{generate.error?.message ?? "Ошибка"}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted/70 whitespace-nowrap">
                    <span className="text-[#58a6ff] font-medium">~{activeModel.cost}</span> кред.
                  </span>
                  <button onClick={() => generate.mutate()} disabled={!prompt.trim() || generate.isPending}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {generate.isPending ? <><Loader2 size={14} className="animate-spin" />Генерация...</> : <><Film size={14} />Сгенерировать</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right — history */}
        <div className="w-[260px] min-w-[260px] border-l border-border flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-muted" />
                <span className="text-[13px] font-semibold text-white">История</span>
              </div>
              {historyItems.length > 0 && (
                <span className="text-[11px] text-muted bg-[#161b22] border border-border px-1.5 py-0.5 rounded-full">{historyItems.length}</span>
              )}
            </div>
            <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Поиск по промпту..." className="input-field text-[12px] py-1.5" />
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                <Film size={20} className="text-muted/40" />
                <div className="text-[12px] text-muted/60">{historySearch ? "Ничего не найдено" : "История пуста"}</div>
              </div>
            ) : (
              filteredHistory.map((file) => (
                <HistoryItem key={file.id} file={file}
                  onUsePrompt={(p) => setPrompt(p)}
                  onDownload={() => downloadVideo(file.url, file.taskId)}
                  onDelete={() => setDeleteConfirm(file.id)}
                  onOpen={() => setLightboxUrl(file.url)} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Video lightbox */}
      {lightboxUrl && <VideoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* Delete video confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[300px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-white">Удалить видео?</h3>
            <p className="text-[13px] text-muted">Это действие необратимо.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
              <button onClick={() => deleteVideo.mutate(deleteConfirm)} disabled={deleteVideo.isPending}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-[13px] text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50">Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete project confirm */}
      {deleteProjectConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDeleteProjectConfirm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[300px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-white">Удалить проект?</h3>
            <p className="text-[13px] text-muted">Это действие необратимо.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteProjectConfirm(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
              <button onClick={() => deleteProject.mutate(deleteProjectConfirm!)} disabled={deleteProject.isPending}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-[13px] text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50">Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* Project form modal */}
      {projectForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setProjectForm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl w-[480px] flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-white">{projectForm.mode === "create" ? "Новый проект" : "Редактировать проект"}</h3>
              <button onClick={() => setProjectForm(null)} className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 flex flex-col gap-4">
              <FormField label="Название *">
                <input type="text" value={projectForm.name}
                  onChange={(e) => setProjectForm((f) => f && { ...f, name: e.target.value })}
                  placeholder="Например: Рекламные ролики" className="input-field" />
              </FormField>
              <FormField label="Стиль (добавляется к промпту)">
                <input type="text" value={projectForm.style}
                  onChange={(e) => setProjectForm((f) => f && { ...f, style: e.target.value })}
                  placeholder="cinematic, 4k, slow motion..." className="input-field" />
              </FormField>
              <FormField label="Системный промпт (placeholder)">
                <textarea value={projectForm.system_prompt} rows={3}
                  onChange={(e) => setProjectForm((f) => f && { ...f, system_prompt: e.target.value })}
                  placeholder="Описание для подсказки в поле промпта..." className="input-field resize-none" />
              </FormField>
              <FormField label="Память / контекст">
                <textarea value={projectForm.memory} rows={3}
                  onChange={(e) => setProjectForm((f) => f && { ...f, memory: e.target.value })}
                  placeholder="Дополнительный контекст..." className="input-field resize-none" />
              </FormField>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setProjectForm(null)} className="px-4 py-2 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
              <button onClick={submitProjectForm}
                disabled={!projectForm.name.trim() || createProject.isPending || updateProject.isPending}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-[13px] text-white font-medium transition-colors disabled:opacity-40">
                {projectForm.mode === "create" ? "Создать" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
