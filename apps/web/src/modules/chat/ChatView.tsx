import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Brain, AlertCircle } from "lucide-react";
import { chatApi, type Chat, type Message } from "../../shared/api/chat";
import { projectsApi, type Project } from "../../shared/api/projects";
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

export default function ChatView({
  chat,
  project,
  engineLabel,
  engineDescription,
  onProjectUpdated,
}: Props) {
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
      const optimistic: Message = {
        id: `opt-${Date.now()}`,
        chat_id: chat?.id ?? "",
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, optimistic]);
    },
    onSuccess: () => {
      setOptimisticMessages([]);
      qc.invalidateQueries({ queryKey: ["messages", chat?.id] });
    },
    onError: () => {
      setOptimisticMessages([]);
    },
  });

  const serverMessages = messagesData?.messages ?? [];
  const allMessages = [...serverMessages, ...optimisticMessages];

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, sendMessage.isPending]);

  // Empty state — no chat selected
  if (!chat) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <ChatHeader
          project={project}
          engineLabel={engineLabel}
          engineDescription={engineDescription}
          onOpenSettings={() => setShowSettings(true)}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center">
            <Brain size={22} className="text-muted" />
          </div>
          <div>
            <p className="text-[15px] font-medium text-white mb-1">
              Чат {engineLabel}
            </p>
            <p className="text-[13px] text-muted">{engineDescription}</p>
          </div>
          {project && (
            <p className="text-[12px] text-muted/70 max-w-xs mt-2">
              Выберите диалог из списка или создайте новый, нажав «Чат».
            </p>
          )}
          {!project && (
            <p className="text-[12px] text-muted/70 max-w-xs mt-2">
              Создайте проект или выберите диалог для начала работы.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      <ChatHeader
        project={project}
        engineLabel={engineLabel}
        engineDescription={engineDescription}
        onOpenSettings={() => setShowSettings(true)}
        chatTitle={chat.title}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
        {loadingMessages && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {!loadingMessages && allMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-[13px] text-muted">Начните диалог — отправьте первое сообщение.</p>
          </div>
        )}

        {allMessages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            engineLabel={engineLabel}
          />
        ))}

        {sendMessage.isPending && (
          <div className="flex items-start gap-2 mb-4">
            <div className="bg-ai-msg rounded-xl rounded-bl-sm px-4 py-3">
              <TypingIndicator />
            </div>
          </div>
        )}

        {sendMessage.isError && (
          <div className="flex items-center gap-2 text-red-400 text-[12px] mb-4 px-2">
            <AlertCircle size={14} />
            {sendMessage.error?.message ?? "Ошибка при отправке сообщения"}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={(text) => sendMessage.mutate({ chatId: chat.id, message: text })}
        isLoading={sendMessage.isPending}
      />

      {/* Settings modal */}
      {showSettings && project && (
        <ProjectSettingsModal
          project={project}
          onClose={() => setShowSettings(false)}
          onSaved={() => {
            setShowSettings(false);
            onProjectUpdated();
          }}
        />
      )}
    </div>
  );
}

function ChatHeader({
  project,
  engineLabel,
  engineDescription,
  onOpenSettings,
  chatTitle,
}: {
  project: Project | null;
  engineLabel: string;
  engineDescription: string;
  onOpenSettings: () => void;
  chatTitle?: string;
}) {
  return (
    <div className="px-6 py-3 border-b border-border bg-panel shrink-0">
      {project && (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-muted uppercase mb-0.5">
              Текущий проект
            </div>
            <div className="text-[18px] font-semibold text-white">{project.name}</div>
            {chatTitle && (
              <div className="text-[12px] text-muted mt-0.5">Чат {engineLabel} · {chatTitle}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-surface hover:bg-border text-[#c9d1d9] transition-colors"
            >
              <Settings size={12} />
              Настройки проекта
            </button>
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-surface hover:bg-border text-[#c9d1d9] transition-colors"
            >
              <Brain size={12} />
              Сохранить память
            </button>
          </div>
        </div>
      )}
      {!project && (
        <div>
          <div className="text-[16px] font-semibold text-white">
            Чат {engineLabel}
          </div>
          <div className="text-[12px] text-muted mt-0.5">{engineDescription}</div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center h-4">
      <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  );
}
