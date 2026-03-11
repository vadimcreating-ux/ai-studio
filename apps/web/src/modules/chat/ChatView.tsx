import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { chatApi, type Chat, type Message } from "../../shared/api/chat";
import { type Project } from "../../shared/api/projects";
import ChatMessage from "./ChatMessage";
import MessageInput from "./MessageInput";
import ProjectSettingsModal from "./ProjectSettingsModal";

type Props = {
  chat: Chat | null;
  project: Project | null;
  engineLabel: string;
  engineDescription: string;
  onProjectUpdated: () => void;
};

export default function ChatView({ chat, project, engineLabel, engineDescription, onProjectUpdated }: Props) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", chat?.id],
    queryFn: () => chatApi.messages(chat!.id),
    enabled: !!chat,
  });

  const sendMessage = useMutation({
    mutationFn: ({ chatId, message }: { chatId: string; message: string }) =>
      chatApi.send(chatId, message),
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
      {/* Project header */}
      {project ? (
        <div className="px-6 py-3 border-b border-[#21262d] shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-semibold tracking-widest text-muted uppercase mb-0.5">
                Текущий проект
              </div>
              <div className="text-[20px] font-semibold text-white leading-tight">{project.name}</div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => setShowSettings(true)}
                className="text-[12px] px-3 py-1.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] transition-colors"
              >
                Настройки проекта
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="text-[12px] px-3 py-1.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] transition-colors"
              >
                Сохранить память
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Chat title */}
      <div className="px-6 py-3 border-b border-[#21262d] shrink-0">
        <div className="text-[15px] font-semibold text-white">Чат {engineLabel}</div>
        <div className="text-[12px] text-muted mt-0.5">
          {project
            ? `Независимая рабочая среда для задач через ${engineLabel}.`
            : engineDescription}
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
        onSend={(text) => chat && sendMessage.mutate({ chatId: chat.id, message: text })}
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
