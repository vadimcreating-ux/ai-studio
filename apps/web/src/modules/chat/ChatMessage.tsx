import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, Pencil, Trash2, RefreshCw, Paperclip, ChevronDown, ChevronUp, Brain } from "lucide-react";
import type { Message, AttachedFile } from "../../shared/api/chat";

type Props = {
  message: Message;
  engineLabel: string;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  isRegenerating?: boolean;
};

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title="Копировать"
      className={`flex items-center gap-1 text-[11px] text-muted hover:text-white transition-colors ${className}`}
    >
      {copied ? <Check size={12} className="text-[#3fb950]" /> : <Copy size={12} />}
      {copied ? "Скопировано" : "Копировать"}
    </button>
  );
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  return (
    <div className="relative group">
      <pre className={className}>
        <code>{children}</code>
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => navigator.clipboard.writeText(children)}
          title="Копировать код"
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#30363d] hover:bg-[#484f58] text-[11px] text-muted hover:text-white transition-colors"
        >
          <Copy size={11} />
          Копировать
        </button>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center h-4">
      <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

export default function ChatMessage({ message, engineLabel, onEdit, onDelete, onRegenerate, isRegenerating }: Props) {
  const isUser = message.role === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [thinkingOpen, setThinkingOpen] = useState(false);

  function handleSaveEdit() {
    const trimmed = editValue.trim();
    if (trimmed) onEdit?.(message.id, trimmed);
    setIsEditing(false);
  }

  function handleCancelEdit() {
    setEditValue(message.content);
    setIsEditing(false);
  }

  if (isUser) {
    if (isEditing) {
      return (
        <div className="flex flex-col mb-5">
          <div className="flex justify-end mb-1.5 pr-1">
            <span className="text-[10px] font-semibold tracking-widest text-blue-400">ВЫ</span>
          </div>
          <div className="flex gap-3">
            {/* Textarea */}
            <div className="flex-1 flex flex-col gap-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                rows={4}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveEdit();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                className="w-full bg-[#1c2128] border border-border rounded-xl px-3 py-2.5 text-[13px] text-white resize-none outline-none focus:border-accent scrollbar-thin leading-relaxed"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 rounded-lg border border-border text-[12px] text-muted hover:text-white transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editValue.trim()}
                  className="px-3 py-1 rounded-lg bg-accent hover:bg-accent-hover text-[12px] text-white disabled:opacity-40 transition-colors"
                >
                  Сохранить
                </button>
              </div>
            </div>
            {/* Live markdown preview */}
            <div className="flex-1 flex flex-col">
              <div className="text-[10px] font-semibold tracking-widest text-muted mb-1.5">PREVIEW</div>
              <div className="flex-1 bg-[#161b22] border border-[#21262d] rounded-xl px-3 py-2.5 text-[13px] text-[#c9d1d9] leading-relaxed overflow-auto min-h-[80px]">
                <div className="prose-chat">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{editValue || " "}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="group flex flex-col items-end mb-5">
        <span className="text-[10px] font-semibold tracking-widest text-blue-400 mb-1.5 pr-1">ВЫ</span>
        {message.attached_files && message.attached_files.length > 0 && (
          <div className="max-w-[62%] mb-1.5 flex flex-col gap-1.5 items-end">
            {message.attached_files.map((f: AttachedFile, i: number) =>
              f.dataUrl ? (
                <img
                  key={i}
                  src={f.dataUrl}
                  alt={f.name}
                  title={f.name}
                  className="max-w-full max-h-64 rounded-xl object-cover border border-white/10"
                />
              ) : (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1d4ed8]/60 border border-white/20 rounded-lg text-[12px] text-white/80">
                  <Paperclip size={11} className="shrink-0" />
                  <span className="max-w-[200px] truncate">{f.name}</span>
                </div>
              )
            )}
          </div>
        )}
        <div className="max-w-[62%] bg-[#1d4ed8] rounded-2xl rounded-br-sm px-4 py-3 text-[13px] text-white leading-relaxed">
          <span className="whitespace-pre-wrap">{message.content}</span>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={() => { setEditValue(message.content); setIsEditing(true); }}
                title="Редактировать"
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-muted hover:text-white transition-colors"
              >
                <Pencil size={11} />
                Редактировать
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(message.id)}
                title="Удалить"
                className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-muted hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Assistant message
  return (
    <div data-role="assistant" className="group flex flex-col items-start mb-5">
      <div className="flex items-center justify-between w-full mb-1.5 px-1">
        <span className="text-[10px] font-semibold tracking-widest text-muted">
          {engineLabel.toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          {onRegenerate && !isRegenerating && (
            <button
              onClick={() => onRegenerate(message.id)}
              title="Сгенерировать снова"
              className="flex items-center gap-1 text-[11px] text-muted hover:text-white transition-colors opacity-0 group-hover:opacity-100"
            >
              <RefreshCw size={11} />
              Повторить
            </button>
          )}
          {onDelete && !isRegenerating && (
            <button
              onClick={() => onDelete(message.id)}
              title="Удалить"
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-muted hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
          <CopyButton text={message.content} />
        </div>
      </div>
      {message.thinking_content && !isRegenerating && (
        <div className="w-full mb-2">
          <button
            onClick={() => setThinkingOpen((v) => !v)}
            className="flex items-center gap-2 text-[11px] text-purple-400 hover:text-purple-300 transition-colors px-1"
          >
            <Brain size={12} />
            Рассуждения модели
            {thinkingOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {thinkingOpen && (
            <div className="mt-2 w-full bg-purple-950/20 border border-purple-500/20 rounded-xl px-4 py-3 text-[12px] text-purple-200/70 leading-relaxed whitespace-pre-wrap font-mono">
              {message.thinking_content}
            </div>
          )}
        </div>
      )}
      <div className="w-full bg-[#161b22] border border-[#21262d] rounded-xl px-4 py-3 text-[13px] text-[#c9d1d9] leading-relaxed">
        {isRegenerating ? (
          <TypingDots />
        ) : (
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children }) {
                  const isBlock = className?.startsWith("language-");
                  const text = String(children).replace(/\n$/, "");
                  if (isBlock) {
                    return <CodeBlock className={className}>{text}</CodeBlock>;
                  }
                  return <code className={className}>{children}</code>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
