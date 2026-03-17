import { useState, useRef, useCallback } from "react";
import { BookOpen, Globe, Paperclip, X } from "lucide-react";

type Props = {
  onSend: (message: string, files: File[], webSearch: boolean) => void;
  onShowTemplates?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  value?: string;
  onChange?: (val: string) => void;
};

export default function MessageInput({ onSend, onShowTemplates, isLoading, disabled, value, onChange }: Props) {
  const [internalText, setInternalText] = useState("");
  const text = value !== undefined ? value : internalText;
  const setText = (val: string) => { onChange ? onChange(val) : setInternalText(val); };
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || isLoading || disabled) return;
    onSend(trimmed, files, webSearch);
    setText("");
    setFiles([]);
  }, [text, files, webSearch, isLoading, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isLoading) return;
    addFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div
      className={`px-5 py-4 border-t border-[#21262d] transition-colors ${isDragging ? "bg-[#1c2128]" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="flex items-center justify-center mb-2 py-2 rounded-lg border-2 border-dashed border-[#388bfd] text-[#388bfd] text-[12px] gap-2">
          <Paperclip size={14} />
          Отпустите файлы для прикрепления
        </div>
      )}

      {/* Attached files */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#21262d] border border-[#30363d] rounded-lg text-[12px] text-[#c9d1d9]"
            >
              <Paperclip size={11} className="text-muted shrink-0" />
              <span className="max-w-[160px] truncate">{file.name}</span>
              <button onClick={() => removeFile(i)} className="text-muted hover:text-white transition-colors ml-0.5">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea row */}
      <div className="flex items-start gap-2">
        {/* File attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isLoading}
          title="Прикрепить файл"
          className="flex items-center justify-center w-[36px] h-[36px] mt-1 rounded-lg border border-[#30363d] text-muted hover:text-[#c9d1d9] hover:bg-[#1c2128] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Paperclip size={15} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.txt,.md,.json,.csv,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder="Напишите сообщение... (Enter — отправить, Shift+Enter — новая строка)"
          rows={6}
          className="flex-1 resize-none bg-transparent border border-[#30363d] rounded-lg px-4 py-3 text-[13px] text-white placeholder:text-[#484f58] outline-none focus:border-[#388bfd] transition-colors scrollbar-thin disabled:opacity-50"
        />
      </div>

      {/* Bottom row: templates + send */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {onShowTemplates && (
            <button
              onClick={onShowTemplates}
              disabled={disabled}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] border-[#30363d] text-muted hover:text-white hover:border-[#484f58] transition-all disabled:opacity-40"
            >
              <BookOpen size={11} />
              Шаблоны
            </button>
          )}
          <button
            onClick={() => setWebSearch((v) => !v)}
            disabled={disabled}
            title={webSearch ? "Поиск в интернете включён" : "Поиск в интернете выключен"}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all disabled:opacity-40 ${
              webSearch
                ? "border-[#388bfd] text-[#388bfd] bg-[#388bfd]/10"
                : "border-[#30363d] text-muted hover:text-white hover:border-[#484f58]"
            }`}
          >
            <Globe size={11} />
            Поиск
          </button>
        </div>
        <button
          onClick={handleSend}
          disabled={(!text.trim() && files.length === 0) || isLoading || disabled}
          className="flex items-center justify-center px-6 h-[36px] rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {isLoading ? (
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:120ms]" />
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:240ms]" />
            </span>
          ) : (
            "Отправить"
          )}
        </button>
      </div>
    </div>
  );
}
