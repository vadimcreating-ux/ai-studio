import { useState, useRef, useCallback } from "react";
import { Paperclip, X } from "lucide-react";

type Props = {
  onSend: (message: string, files: File[]) => void;
  isLoading: boolean;
  disabled?: boolean;
};

export default function MessageInput({ onSend, isLoading, disabled }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || isLoading || disabled) return;
    onSend(trimmed, files);
    setText("");
    setFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, files, isLoading, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
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
    // только если уходим за пределы всего контейнера
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
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
              <button
                onClick={() => removeFile(i)}
                className="text-muted hover:text-white transition-colors ml-0.5"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isLoading}
          title="Прикрепить файл"
          className="flex items-center justify-center w-[46px] h-[46px] rounded-lg border border-[#30363d] text-muted hover:text-[#c9d1d9] hover:bg-[#1c2128] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Paperclip size={16} />
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
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled || isLoading}
          placeholder="Поле ввода сообщения появится здесь"
          rows={1}
          className="flex-1 resize-none bg-transparent border border-[#30363d] rounded-lg px-4 py-3 text-[13px] text-white placeholder:text-[#484f58] outline-none focus:border-[#388bfd] transition-colors scrollbar-thin disabled:opacity-50"
          style={{ minHeight: "46px", maxHeight: "140px" }}
        />
        <button
          onClick={handleSend}
          disabled={(!text.trim() && files.length === 0) || isLoading || disabled}
          className="flex items-center justify-center px-6 h-[46px] rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
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
