import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check } from "lucide-react";
import type { Message } from "../../shared/api/chat";

type Props = {
  message: Message;
  engineLabel: string;
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

export default function ChatMessage({ message, engineLabel }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex flex-col items-end mb-5">
        <span className="text-[10px] font-semibold tracking-widest text-blue-400 mb-1.5 pr-1">
          ВЫ
        </span>
        <div className="max-w-[62%] bg-[#1d4ed8] rounded-2xl rounded-br-sm px-4 py-3 text-[13px] text-white leading-relaxed">
          <span className="whitespace-pre-wrap">{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start mb-5">
      <div className="flex items-center justify-between w-full mb-1.5 px-1">
        <span className="text-[10px] font-semibold tracking-widest text-muted">
          {engineLabel.toUpperCase()}
        </span>
        <CopyButton text={message.content} />
      </div>
      <div className="w-full bg-[#161b22] border border-[#21262d] rounded-xl px-4 py-3 text-[13px] text-[#c9d1d9] leading-relaxed">
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
      </div>
    </div>
  );
}
