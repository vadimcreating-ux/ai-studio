import { useState, useRef, useCallback } from "react";

type Props = {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
};

export default function MessageInput({ onSend, isLoading, disabled }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  return (
    <div className="flex items-end gap-3 px-5 py-4 border-t border-[#21262d]">
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
        disabled={!text.trim() || isLoading || disabled}
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
  );
}
