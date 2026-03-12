import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, X, Paperclip, ImageIcon, Loader2 } from "lucide-react";
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

function pollStatus(taskId: string, apiKey?: string): Promise<string> {
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

export default function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("nano-banana-pro");
  const [aspectRatio, setAspectRatio] = useState("");
  const [resolution, setResolution] = useState("1K");
  const [outputFormat, setOutputFormat] = useState("png");
  const [refImages, setRefImages] = useState<string[]>([]); // URLs
  const [refImageFiles, setRefImageFiles] = useState<File[]>([]);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generate = useMutation({
    mutationFn: async () => {
      setStatusText("Создаём задачу...");

      // Конвертировать загруженные файлы в data URLs (для превью)
      // В реальности KIE ожидает hosted URLs — для простоты передаём только если они URL
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
    },
    onError: () => {
      setStatusText("");
    },
  });

  const handleFileAdd = (files: FileList | null) => {
    if (!files) return;
    // Пока просто добавляем как превью — реальный img2img требует hosted URL
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
        <div className="w-[320px] min-w-[320px] border-r border-border flex flex-col overflow-y-auto scrollbar-thin px-5 py-5 gap-4">

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
                <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border">
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
                  className="w-16 h-16 rounded-lg border border-dashed border-border hover:border-accent flex items-center justify-center text-muted hover:text-white transition-colors"
                >
                  <Paperclip size={16} />
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
            <p className="text-[11px] text-muted leading-snug">До 8 изображений (jpeg/png/webp, макс. 30 МБ). Нужен hosted URL — загрузка через Files.</p>
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

        {/* Right — results */}
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
                <div key={result.taskId} className="break-inside-avoid group relative rounded-xl overflow-hidden border border-border">
                  <img
                    src={result.imageUrl}
                    alt={result.prompt}
                    className="w-full block"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                    <p className="text-[11px] text-white/80 line-clamp-2 leading-snug">{result.prompt}</p>
                    <button
                      onClick={() => downloadImage(result.imageUrl, result.taskId)}
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
