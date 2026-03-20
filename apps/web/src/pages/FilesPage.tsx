import { useState, useMemo, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery as useAuthQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  HardDrive, Trash2, Download, Image, Video, RefreshCw,
  ExternalLink, Copy, Wand2, Search, ChevronUp, ChevronDown,
  CheckSquare, Square, X, Play,
} from "lucide-react";
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
  creditsSpent: number | null;
};

type SortKey = "date" | "size" | "credits";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "image" | "video";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ file, onClose }: { file: FileItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {file.type === "video" ? (
          <video
            src={file.url}
            controls
            autoPlay
            className="max-w-full max-h-[75vh] rounded-xl"
          />
        ) : (
          <img
            src={file.url}
            alt={file.prompt ?? file.name}
            className="max-w-full max-h-[75vh] object-contain rounded-xl"
          />
        )}

        {file.prompt && (
          <p className="mt-3 text-sm text-white/70 text-center max-w-2xl line-clamp-3">
            {file.prompt}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function FilesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  const limit = 30;

  // Filters / sort
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Lightbox
  const [lightbox, setLightbox] = useState<FileItem | null>(null);

  // Expanded prompts
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── Data ──
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  // ── Derived ──
  const rawFiles = data?.files ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const filtered = useMemo(() => {
    let list = rawFiles;
    if (typeFilter !== "all") list = list.filter((f) => f.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.prompt?.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === "date") diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === "size") diff = (a.fileSizeBytes ?? 0) - (b.fileSizeBytes ?? 0);
      else if (sortKey === "credits") diff = (a.creditsSpent ?? 0) - (b.creditsSpent ?? 0);
      return sortDir === "desc" ? -diff : diff;
    });
    return list;
  }, [rawFiles, typeFilter, search, sortKey, sortDir]);

  const usedMb = Number(me?.storage_used_mb ?? 0);
  const quotaMb = me?.storage_quota_mb ?? 500;
  const pct = quotaMb > 0 ? Math.min(100, (usedMb / quotaMb) * 100) : 0;
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-accent";

  // ── Helpers ──
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronDown className="w-3 h-3 text-muted/40" />;
    return sortDir === "desc"
      ? <ChevronDown className="w-3 h-3 text-accent" />
      : <ChevronUp className="w-3 h-3 text-accent" />;
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((f) => selected.has(f.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.id)));
  };

  const handleBulkDelete = useCallback(async () => {
    for (const id of selected) {
      await deleteMutation.mutateAsync(id);
    }
    setSelected(new Set());
  }, [selected, deleteMutation]);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  const handleReusePrompt = (file: FileItem) => {
    const path = file.type === "video" ? "/video" : "/image";
    navigate(path, { state: { prompt: file.prompt ?? "" } });
  };

  const handleDownload = (file: FileItem) => {
    const endpoint = file.type === "video" ? "/api/video/download" : "/api/image/download";
    const a = document.createElement("a");
    a.href = `${endpoint}?url=${encodeURIComponent(file.url)}&name=${encodeURIComponent(file.name)}`;
    a.download = file.name;
    a.click();
  };

  return (
    <>
      {lightbox && <Lightbox file={lightbox} onClose={() => setLightbox(null)} />}

      <div className="flex flex-col h-full overflow-hidden">
        {/* ── Header ── */}
        <div className="flex-none px-6 pt-6 pb-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
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

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Поиск по промпту..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/60"
              />
            </div>

            {/* Type filter */}
            <div className="flex gap-1 bg-surface rounded-lg p-1">
              {(["all", "image", "video"] as TypeFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTypeFilter(t); setPage(0); }}
                  className={`px-3 py-1 text-sm rounded transition-colors ${typeFilter === t ? "bg-accent text-white" : "text-muted hover:text-white"}`}
                >
                  {t === "all" ? "Все" : t === "image" ? "Изображения" : "Видео"}
                </button>
              ))}
            </div>

            {/* Bulk delete */}
            {selected.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Удалить выбранные ({selected.size})
              </button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-5 h-5 text-muted animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-6">
              <HardDrive className="w-10 h-10 text-muted mb-3" />
              {rawFiles.length === 0 ? (
                <>
                  <p className="text-white font-medium mb-1">Файлов пока нет</p>
                  <p className="text-sm text-muted mb-4">Сгенерированные изображения и видео появятся здесь</p>
                  <div className="flex gap-3">
                    <button onClick={() => navigate("/image")} className="px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm text-white transition-colors flex items-center gap-2">
                      <Image className="w-4 h-4" /> Создать изображение
                    </button>
                    <button onClick={() => navigate("/video")} className="px-4 py-2 bg-surface hover:bg-border rounded-lg text-sm text-white transition-colors flex items-center gap-2">
                      <Video className="w-4 h-4" /> Создать видео
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-white font-medium mb-1">Ничего не найдено</p>
                  <p className="text-sm text-muted">Попробуйте изменить поиск или фильтр</p>
                </>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-base border-b border-border z-10">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <button onClick={toggleAll} className="text-muted hover:text-white transition-colors">
                      {allSelected
                        ? <CheckSquare className="w-4 h-4 text-accent" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="w-16 px-2 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Preview</th>
                  <th className="w-20 px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Тип</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Промпт</th>
                  <th
                    className="w-24 px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide cursor-pointer hover:text-white select-none"
                    onClick={() => toggleSort("size")}
                  >
                    <span className="flex items-center gap-1">Размер <SortIcon k="size" /></span>
                  </th>
                  <th
                    className="w-24 px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide cursor-pointer hover:text-white select-none"
                    onClick={() => toggleSort("credits")}
                  >
                    <span className="flex items-center gap-1">Кредиты <SortIcon k="credits" /></span>
                  </th>
                  <th
                    className="w-40 px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide cursor-pointer hover:text-white select-none"
                    onClick={() => toggleSort("date")}
                  >
                    <span className="flex items-center gap-1">Дата <SortIcon k="date" /></span>
                  </th>
                  <th className="w-44 px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    selected={selected.has(file.id)}
                    onToggleSelect={() => toggleSelect(file.id)}
                    onOpen={() => setLightbox(file)}
                    onDownload={() => handleDownload(file)}
                    onCopyUrl={() => handleCopyUrl(file.url)}
                    onReusePrompt={() => handleReusePrompt(file)}
                    onDelete={() => setConfirmDelete(file.id)}
                    expandedPrompt={expandedPrompts.has(file.id)}
                    onTogglePrompt={() =>
                      setExpandedPrompts((prev) => {
                        const next = new Set(prev);
                        next.has(file.id) ? next.delete(file.id) : next.add(file.id);
                        return next;
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex-none flex items-center justify-center gap-2 py-4 border-t border-border">
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
      </div>

      {/* ── Confirm delete dialog ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-panel border border-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-medium mb-2">Удалить файл?</h3>
            <p className="text-sm text-muted mb-5">Это действие нельзя отменить. Файл будет удалён из хранилища.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 bg-surface hover:bg-border rounded-lg text-sm text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm text-white transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── FileRow ───────────────────────────────────────────────────────────────────

type FileRowProps = {
  file: FileItem;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onCopyUrl: () => void;
  onReusePrompt: () => void;
  onDelete: () => void;
  expandedPrompt: boolean;
  onTogglePrompt: () => void;
};

function FileRow({
  file, selected, onToggleSelect, onOpen, onDownload,
  onCopyUrl, onReusePrompt, onDelete, expandedPrompt, onTogglePrompt,
}: FileRowProps) {
  const isVideo = file.type === "video";

  return (
    <tr
      className={`group hover:bg-panel/50 transition-colors ${selected ? "bg-accent/5" : ""}`}
    >
      {/* Checkbox */}
      <td className="px-3 py-3">
        <button onClick={onToggleSelect} className="text-muted hover:text-white transition-colors">
          {selected
            ? <CheckSquare className="w-4 h-4 text-accent" />
            : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
        </button>
      </td>

      {/* Preview */}
      <td className="px-2 py-3">
        <button
          onClick={onOpen}
          className="relative w-12 h-12 rounded-lg overflow-hidden bg-surface flex-shrink-0 hover:ring-2 hover:ring-accent/60 transition-all"
        >
          {isVideo ? (
            <>
              <video src={file.url} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="w-4 h-4 text-white" />
              </div>
            </>
          ) : (
            <img src={file.url} alt="" className="w-full h-full object-cover" loading="lazy" />
          )}
        </button>
      </td>

      {/* Type badge */}
      <td className="px-3 py-3">
        {isVideo ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/15 text-purple-400 text-xs rounded-full border border-purple-500/20">
            <Video className="w-3 h-3" /> Video
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 text-blue-400 text-xs rounded-full border border-blue-500/20">
            <Image className="w-3 h-3" /> Image
          </span>
        )}
      </td>

      {/* Prompt */}
      <td className="px-3 py-3 max-w-xs">
        {file.prompt ? (
          <button
            onClick={onTogglePrompt}
            className="text-left text-muted hover:text-white transition-colors text-xs"
          >
            <span className={expandedPrompt ? "" : "line-clamp-2"}>{file.prompt}</span>
          </button>
        ) : (
          <span className="text-muted/40 text-xs">—</span>
        )}
      </td>

      {/* Size */}
      <td className="px-3 py-3">
        <span className="text-xs text-muted font-mono">{formatBytes(file.fileSizeBytes)}</span>
      </td>

      {/* Credits */}
      <td className="px-3 py-3">
        {file.creditsSpent != null ? (
          <span className="inline-block px-2 py-0.5 bg-surface text-muted text-xs rounded border border-border font-mono">
            {file.creditsSpent} кред.
          </span>
        ) : (
          <span className="text-muted/40 text-xs">—</span>
        )}
      </td>

      {/* Date */}
      <td className="px-3 py-3">
        <span className="text-xs text-muted whitespace-nowrap">{formatDate(file.createdAt)}</span>
      </td>

      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <ActionBtn title="Открыть" onClick={onOpen}>
            <ExternalLink className="w-3.5 h-3.5" />
          </ActionBtn>
          <ActionBtn title="Скачать" onClick={onDownload}>
            <Download className="w-3.5 h-3.5" />
          </ActionBtn>
          <ActionBtn title="Копировать URL" onClick={onCopyUrl}>
            <Copy className="w-3.5 h-3.5" />
          </ActionBtn>
          <ActionBtn title="Переиспользовать промпт" onClick={onReusePrompt}>
            <Wand2 className="w-3.5 h-3.5" />
          </ActionBtn>
          <ActionBtn title="Удалить" onClick={onDelete} danger>
            <Trash2 className="w-3.5 h-3.5" />
          </ActionBtn>
        </div>
      </td>
    </tr>
  );
}

function ActionBtn({
  children, title, onClick, danger,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${
        danger
          ? "text-muted hover:text-red-400 hover:bg-red-500/10"
          : "text-muted hover:text-white hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
