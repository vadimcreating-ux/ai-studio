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
} from "lucide-react";
import { api } from "../shared/api/client";

const MODELS = [
  { value: "nano-banana-pro", label: "Nano Banana Pro" },
];

const ASPECT_RATIOS = [
  { value: "", label: "Auto" },
  { value: "1:1", label: "1:1 — Квадрат" },
  { value: "2:3", label: "2:3 — Портрет" },
  { value: "3:2", label: "3:2 — Пейзаж" },
  { value: "3:4", label: "3:4 — Портрет" },
  { value: "4:3", label: "4:3 — Пейзаж" },
  { value: "4:5", label: "4:5 — Instagram" },
  { value: "5:4", label: "5:4 — Широкий" },
  { value: "9:16", label: "9:16 — Вертикаль" },
  { value: "16:9", label: "16:9 — Горизонталь" },
  { value: "21:9", label: "21:9 — Ультраширокий" },
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
  const [refImages, setRefImages] = useState<string[]>([]);
  const [refImageFiles, setRefImageFiles] = useState<File[]>([]);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [statusText, setStatusText] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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

  const deleteFile = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/files/${id}`),
    onSuccess: () => {
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      setStatusText("Создаём задачу...");

      const imageInput = refImages.length > 0 ? refImages : undefined;

      const data = await api.post<{ ok: boolean; taskId: string }>(
        "/api/image/generate",
        {
          model,
          prompt,
          image_input: imageInput,
          aspect_ratio: aspectRatio || undefined,
          resolution,
          output_format: outputFormat,
        }
      );

      setStatusText("Генерация... (обычно 10–30 секунд)");
      const imageUrl = await pollStatus(data.taskId);
      setStatusText("");
      return { taskId: data.taskId, imageUrl, prompt };
    },
    onSuccess: (result) => {
      setResults((prev) => [result, ...prev]);
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
    onError: () => {
      setStatusText("");
    },
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-border shrink-0">
        <h1 className="text-[22px] font-semibold text-white leading-tight">Image</h1>
        <p className="text-[13px] text-muted mt-0.5">Генерация изображений через KIE API</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — settings */}
        <div className="w-[280px] min-w-[280px] border-r border-border flex flex-col overflow-y-auto scrollbar-thin px-5 py-5 gap-4">

          {/* Model */}
          <Field label="Модель">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="input-field"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>

          {/* Prompt */}
          <Field label="Промпт" required>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Описание изображения на английском..."
              rows={5}
              className="input-field resize-none scrollbar-thin"
            />
            <div className="text-[11px] text-muted mt-1 text-right">{prompt.length} / 20000</div>
          </Field>

          {/* Reference images (img2img) */}
          <Field label="Референсные изображения (опционально)">
            <div className="flex flex-wrap gap-2 mb-2">
              {refImageFiles.map((file, i) => (
                <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-border">
                  <img
                    src={URL.createObjectURL(file)}
                    className="w-full h-full object-cover"
                    alt={file.name}
                  />
                  <button
                    onClick={() => removeRefFile(i)}
                    className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
              {refImageFiles.length < 8 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-14 h-14 rounded-lg border border-dashed border-border hover:border-accent flex items-center justify-center text-muted hover:text-white transition-colors"
                >
                  <Paperclip size={14} />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFileAdd(e.target.files)}
            />
            <p className="text-[11px] text-muted leading-snug">До 8 изображений. Нужен hosted URL — загрузка через Files.</p>
          </Field>

          {/* Aspect ratio */}
          <Field label="Соотношение сторон">
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="input-field"
            >
              {ASPECT_RATIOS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>

          {/* Resolution */}
          <Field label="Разрешение">
            <div className="flex gap-2">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setResolution(r.value)}
                  className={`flex-1 py-1.5 rounded-lg text-[13px] border transition-colors ${
                    resolution === r.value
                      ? "bg-accent border-accent text-white"
                      : "border-border text-muted hover:text-white hover:border-[#484f58]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Output format */}
          <Field label="Формат">
            <div className="flex gap-2">
              {OUTPUT_FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setOutputFormat(f.value)}
                  className={`flex-1 py-1.5 rounded-lg text-[13px] border transition-colors ${
                    outputFormat === f.value
                      ? "bg-accent border-accent text-white"
                      : "border-border text-muted hover:text-white hover:border-[#484f58]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Generate button */}
          <button
            onClick={() => generate.mutate()}
            disabled={!prompt.trim() || generate.isPending}
            className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover text-white text-[14px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generate.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Генерация...
              </>
            ) : (
              <>
                <ImageIcon size={16} />
                Сгенерировать
              </>
            )}
          </button>

          {/* Status */}
          {statusText && (
            <div className="text-[12px] text-muted text-center animate-pulse">{statusText}</div>
          )}

          {/* Error */}
          {generate.isError && (
            <div className="text-[12px] text-red-400 text-center">
              {generate.error?.message ?? "Ошибка генерации"}
            </div>
          )}
        </div>

        {/* Center — current session results */}
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
                <div
                  key={result.taskId}
                  className="break-inside-avoid group relative rounded-xl overflow-hidden border border-border cursor-pointer"
                  onClick={() => setLightboxUrl(result.imageUrl)}
                >
                  <img
                    src={result.imageUrl}
                    alt={result.prompt}
                    className="w-full block"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                    <p className="text-[11px] text-white/80 line-clamp-2 leading-snug">{result.prompt}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadImage(result.imageUrl, result.taskId); }}
                      className="flex items-center gap-1.5 self-end px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12px] transition-colors"
                    >
                      <Download size={13} />
                      Скачать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — history */}
        <div className="w-[280px] min-w-[280px] border-l border-border flex flex-col overflow-hidden">
          {/* History header */}
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

          {/* History list */}
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

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-[#161b22] border border-border rounded-xl p-5 w-[300px] flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[14px] font-semibold text-white">Удалить изображение?</div>
            <div className="text-[13px] text-muted">Это действие нельзя отменить.</div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => deleteFile.mutate(deleteConfirm)}
                disabled={deleteFile.isPending}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-[13px] text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {deleteFile.isPending ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxUrl}
              className="max-w-full max-h-[85vh] rounded-xl object-contain"
              alt=""
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-[#161b22] border border-border rounded-full flex items-center justify-center text-muted hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryItem({
  file,
  onUsePrompt,
  onDownload,
  onDelete,
  onOpen,
}: {
  file: FileItem;
  onUsePrompt: (p: string) => void;
  onDownload: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="group flex gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
      {/* Thumbnail */}
      <div
        className="w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0 cursor-pointer hover:border-accent transition-colors"
        onClick={onOpen}
      >
        <img src={file.url} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>

      {/* Info + actions */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <p
            className="text-[12px] text-white/80 leading-snug line-clamp-2 cursor-pointer hover:text-white transition-colors"
            title={file.prompt ?? ""}
            onClick={onOpen}
          >
            {file.prompt || <span className="text-muted italic">без промпта</span>}
          </p>
          <p className="text-[10px] text-muted mt-0.5">{formatDate(file.createdAt)}</p>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-0.5 mt-1">
          {file.prompt && (
            <button
              title="Использовать промпт"
              onClick={() => onUsePrompt(file.prompt!)}
              className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors"
            >
              <RotateCcw size={12} />
            </button>
          )}
          <CopyUrlButton url={file.url} />
          <button
            title="Скачать"
            onClick={onDownload}
            className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors"
          >
            <Download size={12} />
          </button>
          <button
            title="Удалить"
            onClick={onDelete}
            className="p-1 rounded hover:bg-white/10 text-muted hover:text-red-400 transition-colors ml-auto"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-white uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
