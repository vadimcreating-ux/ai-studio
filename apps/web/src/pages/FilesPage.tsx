import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery as useAuthQuery } from "@tanstack/react-query";
import { HardDrive, Trash2, Download, Image, Video, RefreshCw } from "lucide-react";
import { api } from "../shared/api/client";
import { authApi } from "../shared/api/auth";

type FileItem = {
  id: string;
  taskId: string;
  type: "image" | "video";
  name: string;
  url: string;
  createdAt: string;
  prompt: string | null;
  fileSizeBytes: number | null;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function FilesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const limit = 24;

  const { data: me } = useAuthQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me().then((r) => r.data),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["files", page],
    queryFn: () =>
      api.get<{ ok: boolean; files: FileItem[]; total: number; limit: number; offset: number }>(
        `/api/files?limit=${limit}&offset=${page * limit}`
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/files/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });

  const files = data?.files ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const usedMb = Number(me?.storage_used_mb ?? 0);
  const quotaMb = me?.storage_quota_mb ?? 500;
  const pct = quotaMb > 0 ? Math.min(100, (usedMb / quotaMb) * 100) : 0;
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-accent";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-white">Мои файлы</h1>
          <span className="text-sm text-muted">{total} файлов</span>
        </div>

        {/* Storage bar */}
        {me && (
          <div className="bg-panel border border-border rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-white">
                <HardDrive className="w-4 h-4 text-muted" />
                <span>Хранилище</span>
              </div>
              <span className="text-sm text-muted">
                {usedMb.toFixed(1)} MB / {quotaMb} MB
              </span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            {pct >= 90 && (
              <p className="text-xs text-red-400 mt-1.5">
                Хранилище почти заполнено. Удалите старые файлы или обратитесь к администратору.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Files grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 text-muted animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <HardDrive className="w-10 h-10 text-muted mb-3" />
            <p className="text-white font-medium mb-1">Файлов пока нет</p>
            <p className="text-sm text-muted">Сгенерированные изображения и видео появятся здесь</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {files.map((f) => (
                <FileCard key={f.id} file={f} onDelete={() => deleteMutation.mutate(f.id)} deleting={deleteMutation.isPending} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || isFetching}
                  className="px-3 py-1.5 bg-surface hover:bg-border disabled:opacity-40 text-sm text-muted hover:text-white rounded transition-colors"
                >
                  ←
                </button>
                <span className="text-sm text-muted">{page + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || isFetching}
                  className="px-3 py-1.5 bg-surface hover:bg-border disabled:opacity-40 text-sm text-muted hover:text-white rounded transition-colors"
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FileCard({ file, onDelete, deleting }: { file: FileItem; onDelete: () => void; deleting: boolean }) {
  const isVideo = file.type === "video";

  const handleDownload = () => {
    const endpoint = isVideo ? "/api/video/download" : "/api/image/download";
    const a = document.createElement("a");
    a.href = `${endpoint}?url=${encodeURIComponent(file.url)}&name=${encodeURIComponent(file.name)}`;
    a.download = file.name;
    a.click();
  };

  return (
    <div className="group relative bg-panel border border-border rounded-xl overflow-hidden hover:border-accent/50 transition-colors">
      {/* Preview */}
      <div className="aspect-square bg-surface flex items-center justify-center relative overflow-hidden">
        {isVideo ? (
          <video src={file.url} className="w-full h-full object-cover" muted playsInline />
        ) : (
          <img src={file.url} alt={file.prompt ?? file.name} className="w-full h-full object-cover" loading="lazy" />
        )}
        <div className="absolute top-2 left-2">
          {isVideo ? (
            <Video className="w-3.5 h-3.5 text-white drop-shadow" />
          ) : (
            <Image className="w-3.5 h-3.5 text-white drop-shadow" />
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        {file.prompt && (
          <p className="text-xs text-muted truncate mb-1" title={file.prompt}>{file.prompt}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{formatBytes(file.fileSizeBytes)}</span>
          <span className="text-xs text-muted">{formatDate(file.createdAt)}</span>
        </div>
      </div>

      {/* Actions overlay */}
      <div className="absolute inset-0 bg-base/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={handleDownload}
          className="p-2 bg-surface hover:bg-border rounded-lg text-white transition-colors"
          title="Скачать"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-red-400 transition-colors disabled:opacity-50"
          title="Удалить"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
