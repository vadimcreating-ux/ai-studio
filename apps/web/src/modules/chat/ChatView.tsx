import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BookOpen, Plus, Search, Trash2, X } from "lucide-react";
// BookOpen used in templates modal below
import { chatApi, type Chat, type Message } from "../../shared/api/chat";
import { type Project } from "../../shared/api/projects";
import ChatMessage from "./ChatMessage";
import MessageInput from "./MessageInput";
import ProjectSettingsModal from "./ProjectSettingsModal";


const TEMPLATES_KEY = "ai_studio_prompt_templates";

type Template = { id: string; title: string; text: string };

function loadTemplates(): Template[] {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? "[]"); }
  catch { return []; }
}

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
  const [inputText, setInputText] = useState("");

  // Templates
  const [templates, setTemplates] = useState<Template[]>(loadTemplates);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [newTplTitle, setNewTplTitle] = useState("");
  const [newTplText, setNewTplText] = useState("");
  const [deleteTplConfirm, setDeleteTplConfirm] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }, [templates]);

  const filteredTemplates = templateSearch.trim()
    ? templates.filter((t) =>
        t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.text.toLowerCase().includes(templateSearch.toLowerCase())
      )
    : templates;

  function addTemplate() {
    if (!newTplTitle.trim() || !newTplText.trim()) return;
    setTemplates((prev) => [...prev, { id: Date.now().toString(), title: newTplTitle.trim(), text: newTplText.trim() }]);
    setNewTplTitle("");
    setNewTplText("");
    setAddingTemplate(false);
  }

  const isClaudeEngine = engineLabel === "Claude";


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

  const editMessage = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      chatApi.updateMessage(chat!.id, messageId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", chat?.id] }),
  });

  const deleteMessage = useMutation({
    mutationFn: (messageId: string) => chatApi.deleteMessage(chat!.id, messageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", chat?.id] }),
  });

  const regenerateMsg = useMutation({
    mutationFn: (messageId: string) => chatApi.regenerate(chat!.id, messageId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["messages", chat?.id] });
      if (data.credits_spent) {
        window.dispatchEvent(new CustomEvent("creditsSpent", { detail: { amount: data.credits_spent } }));
      }
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ chatId, message, files, webSearch }: { chatId: string; message: string; files: File[]; webSearch: boolean }) => {
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
      return chatApi.send(chatId, message, converted.length > 0 ? converted : undefined, webSearch || undefined);
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
    onSuccess: (data) => {
      setOptimisticMessages([]);
      qc.invalidateQueries({ queryKey: ["messages", chat?.id] });
      if (data.credits_spent) {
        window.dispatchEvent(new CustomEvent("creditsSpent", { detail: { amount: data.credits_spent } }));
      }
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
        <div className="text-[14px] font-semibold text-white truncate max-w-[50%] text-center">
          {project ? `Проект — ${project.name}` : engineLabel}
        </div>
        <div className="absolute right-6 flex items-center gap-2">
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
          </div>
        )}

        {allMessages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            engineLabel={engineLabel}
            onEdit={(id, content) => editMessage.mutate({ messageId: id, content })}
            onDelete={(id) => deleteMessage.mutate(id)}
            onRegenerate={msg.role === "assistant" ? (id) => regenerateMsg.mutate(id) : undefined}
            isRegenerating={regenerateMsg.isPending && regenerateMsg.variables === msg.id}
          />
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
        onSend={(text, files, webSearch) => { chat && sendMessage.mutate({ chatId: chat.id, message: text, files, webSearch }); setInputText(""); }}
        onShowTemplates={() => setShowTemplates(true)}
        isLoading={sendMessage.isPending}
        disabled={!chat}
      />

      {/* Project settings modal */}
      {showSettings && project && (
        <ProjectSettingsModal
          project={project}
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); onProjectUpdated(); }}
        />
      )}

      {/* Templates modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowTemplates(false)}>
          <div className="bg-[#161b22] border border-border rounded-xl w-[540px] flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-accent" />
                <h3 className="text-[15px] font-semibold text-white">Шаблоны промптов</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAddingTemplate((v) => !v)}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
                >
                  <Plus size={12} />Добавить
                </button>
                <button onClick={() => setShowTemplates(false)} className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-border shrink-0">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Поиск шаблонов..."
                  className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-lg text-[12px] text-white placeholder:text-muted outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Add form */}
            {addingTemplate && (
              <div className="px-5 py-3 border-b border-border bg-[#1c2128] shrink-0 flex flex-col gap-2">
                <input
                  autoFocus
                  value={newTplTitle}
                  onChange={(e) => setNewTplTitle(e.target.value)}
                  placeholder="Название шаблона"
                  className="w-full bg-base border border-border rounded-lg px-3 py-1.5 text-[12px] text-white placeholder:text-muted outline-none focus:border-accent"
                />
                <textarea
                  value={newTplText}
                  onChange={(e) => setNewTplText(e.target.value)}
                  placeholder="Текст промпта..." rows={3}
                  className="w-full bg-base border border-border rounded-lg px-3 py-1.5 text-[12px] text-white placeholder:text-muted outline-none focus:border-accent resize-none scrollbar-thin"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addTemplate}
                    disabled={!newTplTitle.trim() || !newTplText.trim()}
                    className="flex-1 text-[12px] py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => { setAddingTemplate(false); setNewTplTitle(""); setNewTplText(""); }}
                    className="flex-1 text-[12px] py-1.5 rounded-lg bg-surface hover:bg-border text-muted transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {/* Templates list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
                  <BookOpen size={24} className="text-muted/40" />
                  <p className="text-[13px] text-muted">{templateSearch ? "Ничего не найдено" : "Нет шаблонов. Нажмите «Добавить»."}</p>
                </div>
              ) : (
                filteredTemplates.map((tpl) => (
                  <div key={tpl.id} className="group px-5 py-3 border-b border-border hover:bg-surface transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-white truncate flex-1">{tpl.title}</span>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setInputText(tpl.text); setShowTemplates(false); }}
                          className="text-[11px] px-2 py-0.5 rounded bg-accent/20 hover:bg-accent/30 text-accent transition-colors"
                        >
                          Вставить
                        </button>
                        <button
                          onClick={() => setDeleteTplConfirm(tpl.id)}
                          className="p-1 rounded hover:bg-white/10 text-muted hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted leading-snug line-clamp-2">{tpl.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete template confirmation */}
      {deleteTplConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => setDeleteTplConfirm(null)}>
          <div className="bg-[#161b22] border border-border rounded-xl p-5 w-[300px] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-white">Удалить шаблон?</div>
            <div className="text-[13px] text-muted">Это действие нельзя отменить.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTplConfirm(null)} className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors">Отмена</button>
              <button
                onClick={() => { setTemplates((prev) => prev.filter((t) => t.id !== deleteTplConfirm)); setDeleteTplConfirm(null); }}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-[13px] text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
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
