import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../../shared/api/chat";

type Props = {
  message: Message;
  engineLabel: string;
};

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
      <span className="text-[10px] font-semibold tracking-widest text-muted mb-1.5 pl-1">
        {engineLabel.toUpperCase()}
      </span>
      <div className="w-full bg-[#161b22] border border-[#21262d] rounded-xl px-4 py-3 text-[13px] text-[#c9d1d9] leading-relaxed">
        <div className="prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
