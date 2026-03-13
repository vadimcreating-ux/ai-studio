import { useState, useEffect } from "react";
import { Plus, Search, Trash2, CornerDownLeft } from "lucide-react";

type Prompt = { id: string; title: string; text: string };

const STORAGE_KEY = "ai_studio_prompt_templates";

function loadPrompts(): Prompt[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

type Props = { onInsert: (text: string) => void };

export default function PromptsPanel({ onInsert }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>(loadPrompts);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  }, [prompts]);

  function addPrompt() {
    if (!newTitle.trim() || !newText.trim()) return;
    setPrompts((prev) => [
      ...prev,
      { id: Date.now().toString(), title: newTitle.trim(), text: newText.trim() },
    ]);
    setNewTitle("");
    setNewText("");
    setAdding(false);
  }

  function deletePrompt(id: string) {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered = prompts.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.text.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col w-[280px] min-w-[280px] h-full bg-panel border-l border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="text-[14px] font-semibold text-white">Шаблоны промптов</div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-accent hover:bg-accent-hover text-white transition-colors"
        >
          <Plus size={11} />
          Добавить
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск шаблонов..."
            className="w-full pl-7 pr-2.5 py-1.5 bg-surface border border-border rounded text-[12px] text-white placeholder:text-muted outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="px-3 py-3 border-b border-border bg-[#1c2128] shrink-0">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Название шаблона"
            className="w-full bg-base border border-border rounded px-2.5 py-1.5 text-[12px] text-white placeholder:text-muted outline-none focus:border-accent mb-2"
          />
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Текст промпта..."
            rows={3}
            className="w-full bg-base border border-border rounded px-2.5 py-1.5 text-[12px] text-white placeholder:text-muted outline-none focus:border-accent resize-none scrollbar-thin"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={addPrompt}
              disabled={!newTitle.trim() || !newText.trim()}
              className="flex-1 text-[12px] py-1 rounded bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors"
            >
              Сохранить
            </button>
            <button
              onClick={() => { setAdding(false); setNewTitle(""); setNewText(""); }}
              className="flex-1 text-[12px] py-1 rounded bg-surface hover:bg-border text-[#8b949e] transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Prompts list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-[12px] text-muted leading-snug">
              {search ? "Ничего не найдено." : "Нет шаблонов.\nНажмите «Добавить»."}
            </p>
          </div>
        )}

        {filtered.map((prompt) => (
          <div
            key={prompt.id}
            className="group px-3 py-2.5 border-b border-border hover:bg-surface transition-colors"
          >
            <div className="flex items-start justify-between gap-1.5 mb-1">
              <span className="text-[12px] font-semibold text-white leading-snug truncate flex-1">
                {prompt.title}
              </span>
              <button
                onClick={() => deletePrompt(prompt.id)}
                className="text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
              >
                <Trash2 size={11} />
              </button>
            </div>
            <p className="text-[11px] text-muted leading-snug line-clamp-2 mb-2">
              {prompt.text}
            </p>
            <button
              onClick={() => onInsert(prompt.text)}
              className="flex items-center gap-1 text-[11px] text-accent hover:text-white transition-colors"
            >
              <CornerDownLeft size={11} />
              Вставить в чат
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
