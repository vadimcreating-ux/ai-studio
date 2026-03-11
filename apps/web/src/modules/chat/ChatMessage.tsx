import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../../shared/api/chat";

type Props = {
  message: Message;
  engineLabel: string;
};

export default function ChatMessage({ message, engineLabel }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} mb-4`}>
      {/* Role label */}
      <div className={`text-[10px] font-semibold tracking-wider mb-1 ${
        isUser ? "text-blue-400 pr-1" : "text-muted pl-1"
      }`}>
        {isUser ? "ВЫ" : engineLabel.toUpperCase()}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 text-[13px] leading-relaxed ${
          isUser
            ? "bg-user-msg text-white rounded-br-sm"
            : "bg-ai-msg text-[#e6edf3] rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
