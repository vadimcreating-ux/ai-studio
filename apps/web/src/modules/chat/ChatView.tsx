import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { chatApi, type Chat, type Message } from "../../shared/api/chat";
import { type Project } from "../../shared/api/projects";
import ChatMessage from "./ChatMessage";
import MessageInput from "./MessageInput";
import ProjectSettingsModal from "./ProjectSettingsModal";


const CLAUDE_MODELS = [
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
];

type Props = {
  chat: Chat | null;
  project: Project | null;
  engineLabel: string;
  engineDescription: string;
  insertText: string | null;
  onInsertConsumed: () => void;
  onProjectUpdated: () => void;
};

export default function ChatView({ chat, project, engineLabel, engineDescription, insertText, onInsertConsumed, onProjectUpdated }: Props) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  const isClaudeEngine = engineLabel === "Claude";
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    if (insertText !== null) {
      setInputText(insertText);
      onInsertConsumed();
    }
  }, [insertText]);

  const updateModel = useMutation({
    mutationFn: (model: string) => chatApi.updateModel(chat!.id, model),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chats"] }),
  });

  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", chat?.id],
    queryFn: () => chatApi.messages(chat!.id),
    enabled: !!chat,
  });

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });

  const sendMessage = useMutation({
    mutationFn: async ({ chatId, message, files }: { chatId: string; message: string; files: File[] }) => {
      const converted = await Promise.all(
        files.map(async (file) => {
          if (file.type.startsWith("image/")) {
            const dataUrl = await readFileAsDataUrl(file);
            return { dataUrl, mimeType: file.type, name: file.name };
          } else {
            const text = await readFileAsText(file);
            return { dataUrl: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(text)))}`, mimeType: "text/plain", name: file.name };
          }
        })
      );
      return chatApi.send(chatId, message, converted.length > 0 ? converted : undefined);
    },
    onMutate: ({ message }) => {
      const opt: Message = {
        id: `opt-${Date.now()}`,
        chat_id: chat?.id ?? "",
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, opt]);
    },
    onSuccess: () => {
      setOptimisticMessages([]);
      qc.invalidateQueries({ queryKey: ["messages", chat?.id] });
    },
    onError: () => setOptimisticMessages([]),
  });

  const allMessages = [...(messagesData?.messages ?? []), ...optimisticMessages];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, sendMessage.isPending]);

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
      {/* Header bar */}
      <div className="px-6 py-3 border-b border-[#21262d] shrink-0 relative flex items-center justify-center">
        {/* Centered title */}
        <div className="text-[14px] font-semibold text-white truncate max-w-[50%] text-center">
          {project ? `Проект — ${project.name}` : engineLabel}
        </div>
        {/* Right actions */}
        <div className="absolute right-6 flex items-center gap-2">
          {chat && isClaudeEngine && (
            <select
              value={chat.model}
              onChange={(e) => updateModel.mutate(e.target.value)}
              disabled={updateModel.isPending}
              className="text-[12px] bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded-md px-2 py-1 cursor-pointer hover:bg-[#30363d] transition-colors"
            >
              {CLAUDE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          )}
          {project && (
            <button
              onClick={() => setShowSettings(true)}
              className="text-[12px] px-3 py-1.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] transition-colors"
            >
              Настройки проекта
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5">
        {loadingMessages && (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#30363d] border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {!loadingMessages && allMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-[13px] text-muted">
              {chat ? "Начните диалог — отправьте первое сообщение." : "Выберите чат или создайте новый"}
            </div>
            {!chat && (
              <div className="text-[12px] text-muted/60 mt-1">
                Создать первый чат
              </div>
            )}
          </div>
        )}

        {allMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} engineLabel={engineLabel} />
        ))}

        {sendMessage.isPending && (
          <div className="flex flex-col items-start mb-5">
            <span className="text-[10px] font-semibold tracking-widest text-muted mb-1.5 pl-1">
              {engineLabel.toUpperCase()}
            </span>
            <div className="w-full bg-[#161b22] border border-[#21262d] rounded-xl px-4 py-3">
              <TypingDots />
            </div>
          </div>
        )}

        {sendMessage.isError && (
          <div className="flex items-center gap-2 text-red-400 text-[12px] mb-4">
            <AlertCircle size={13} />
            {sendMessage.error?.message ?? "Ошибка при отправке"}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        value={inputText}
        onChange={setInputText}
        onSend={(text, files) => { chat && sendMessage.mutate({ chatId: chat.id, message: text, files }); setInputText(""); }}
        isLoading={sendMessage.isPending}
        disabled={!chat}
      />

      {showSettings && project && (
        <ProjectSettingsModal
          project={project}
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); onProjectUpdated(); }}
        />
      )}
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
