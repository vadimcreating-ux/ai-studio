import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Brain, Save } from "lucide-react";
import { engineSettingsApi } from "../../shared/api/engine-settings";

type Props = {
  engine: string;
  engineLabel: string;
  onClose: () => void;
};

export default function GlobalMemoryModal({ engine, engineLabel, onClose }: Props) {
  const qc = useQueryClient();
  const [about, setAbout] = useState("");
  const [instructions, setInstructions] = useState("");
  const [memory, setMemory] = useState("");
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["engine-settings", engine],
    queryFn: () => engineSettingsApi.get(engine),
  });

  useEffect(() => {
    if (data?.settings) {
      setAbout(data.settings.about);
      setInstructions(data.settings.instructions);
      setMemory(data.settings.memory);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => engineSettingsApi.save(engine, { about, instructions, memory }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engine-settings", engine] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const hasContent = about.trim() || instructions.trim() || memory.trim();

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#161b22] border border-border rounded-xl w-[520px] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Brain size={16} className="text-accent" />
            <div>
              <h3 className="text-[15px] font-semibold text-white">Персонализация</h3>
              <p className="text-[11px] text-muted mt-0.5">
                Подключается к каждому чату {engineLabel} — с проектом и без
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#30363d] border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 flex flex-col gap-5">

            {/* О пользователе */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <label className="text-[12px] font-medium text-white/80">О вас</label>
                <span className="text-[11px] text-muted">ИИ будет знать это во всех чатах</span>
              </div>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={3}
                placeholder={"Меня зовут Вадим, я занимаюсь фото и видеосъёмкой, путешествиями по Алтаю..."}
                className="input-field resize-none scrollbar-thin text-[13px]"
              />
            </div>

            {/* Инструкции */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <label className="text-[12px] font-medium text-white/80">Инструкции</label>
                <span className="text-[11px] text-muted">Как всегда отвечать — стиль, тон, правила</span>
              </div>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder={"Отвечай кратко и по делу. Используй русский язык. Не используй эмодзи..."}
                className="input-field resize-none scrollbar-thin text-[13px]"
              />
            </div>

            {/* Память */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <label className="text-[12px] font-medium text-white/80">Память</label>
                <span className="text-[11px] text-muted">Факты и контекст, которые всегда в памяти</span>
              </div>
              <textarea
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
                rows={4}
                placeholder={"Мой основной язык — русский. Я работаю в часовом поясе UTC+7. Предпочитаю списки вместо длинных абзацев..."}
                className="input-field resize-none scrollbar-thin text-[13px]"
              />
            </div>

            {/* Status indicator */}
            {hasContent && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
                <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span className="text-[11px] text-accent/80">
                  Персонализация активна — применяется ко всем чатам {engineLabel}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-[13px] text-muted hover:text-white transition-colors"
          >
            Закрыть
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-medium transition-colors disabled:opacity-40"
          >
            {save.isPending ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Сохранение...</>
            ) : saved ? (
              <><Save size={13} />Сохранено!</>
            ) : (
              <><Save size={13} />Сохранить</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
