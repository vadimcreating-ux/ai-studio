import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { chatApi, type Chat } from "../../shared/api/chat";
import { formatDate } from "../../shared/utils/date";

type Props = {
  engine: string;
  selectedProjectId: string | null;
  selectedChatId: string | null;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  defaultModel: string;
};

export default function PromptsPanel({
  engine, selectedProjectId, selectedChatId, onSelectChat, onNewChat, defaultModel,
}: Props) {
  const qc = useQueryClient();
  const [deleteChatConfirm, setDeleteChatConfirm] = useState<string | null>(null);

  const { data: chatsData } = useQuery({
    queryKey: ["chats", engine, selectedProjectId],
    queryFn: () => chatApi.list(engine, selectedProjectId ?? undefined),
  });

  const createChat = useMutation({
    mutationFn: () => chatApi.create({ module: engine, model: defaultModel, project_id: selectedProjectId ?? undefined }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chats", engine, selectedProjectId] });
      onSelectChat(data.chat);
    },
  });

  const deleteChat = useMutation({
    mutationFn: (id: string) => chatApi.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["chats", engine, selectedProjectId] });
      if (selectedChatId === id) onNewChat();
      setDeleteChatConfirm(null);
    },
  });

  const chats = chatsData?.chats ?? [];

  return (
    <div className="flex flex-col w-[240px] min-w-[240px] h-full bg-panel border-l border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-[13px] font-semibold text-white">История чатов</span>
        <button
          onClick={() => createChat.mutate()}
          disabled={createChat.isPending}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-surface hover:bg-border text-[#c9d1d9] transition-colors disabled:opacity-40"
        >
          <Plus size={11} />
          Новый чат
        </button>
      </div>

      {/* Chats list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {chats.length === 0 ? (
          <p className="px-4 py-3 text-[12px] text-muted leading-snug">
            {selectedProjectId ? "Нет диалогов в этом проекте." : "Нет диалогов. Нажмите «Новый чат»."}
          </p>
        ) : (
          chats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={selectedChatId === chat.id}
              onClick={() => onSelectChat(chat)}
              onDelete={() => setDeleteChatConfirm(chat.id)}
            />
          ))
        )}
      </div>

      {/* Delete chat confirmation */}
      {deleteChatConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteChatConfirm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[300px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Удалить диалог?</div>
            <div className="text-[13px] text-muted">История сообщений будет удалена. Это действие нельзя отменить.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteChatConfirm(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
              <button onClick={() => deleteChat.mutate(deleteChatConfirm)} disabled={deleteChat.isPending}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-[13px] text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                {deleteChat.isPending ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatItem({ chat, isActive, onClick, onDelete }: {
  chat: Chat; isActive: boolean; onClick: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group px-4 py-3 cursor-pointer border-l-[3px] transition-all ${
        isActive ? "border-accent bg-[#1c2740]" : "border-transparent hover:bg-[#1c2128]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[13px] font-semibold truncate ${isActive ? "text-white" : "text-[#c9d1d9]"}`}>
            {chat.title}
          </div>
          <div className="text-[11px] text-muted mt-0.5">{formatDate(chat.created_at)}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 rounded hover:text-red-400 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
