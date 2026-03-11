import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";

type Props = {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export default function MessageInput({ onSend, isLoading, disabled, placeholder }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, isLoading, disabled, onSend]);

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
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex items-end gap-3 px-4 py-3 border-t border-border bg-panel">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={disabled || isLoading}
        placeholder={placeholder ?? "Поле ввода сообщения появится здесь"}
        rows={1}
        className="flex-1 resize-none bg-base border border-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-muted outline-none focus:border-accent transition-colors scrollbar-thin disabled:opacity-50"
        style={{ minHeight: "42px", maxHeight: "160px" }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || isLoading || disabled}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        {isLoading ? (
          <span className="flex gap-0.5">
            <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        ) : (
          <Send size={14} />
        )}
        Отправить
      </button>
    </div>
  );
}
