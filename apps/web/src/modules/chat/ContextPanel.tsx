import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit3, Clock, BookOpen, Brain } from "lucide-react";
import { projectsApi, type Project } from "../../shared/api/projects";

type Props = {
  project: Project | null;
  engine: string;
  engineLabel: string;
};

export default function ContextPanel({ project, engine, engineLabel }: Props) {
  const qc = useQueryClient();
  const [editingMemory, setEditingMemory] = useState(false);
  const [memoryText, setMemoryText] = useState("");

  const updateProject = useMutation({
    mutationFn: (data: Partial<Project>) =>
      projectsApi.update(project!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", engine] });
      setEditingMemory(false);
    },
  });

  return (
    <div className="flex flex-col w-[280px] min-w-[280px] h-full bg-panel border-l border-border overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[14px] font-semibold text-white">
            Контекст и память
          </div>
        </div>
        {project && (
          <button
            onClick={() => {
              setMemoryText(project.memory || "");
              setEditingMemory(true);
            }}
            className="text-[11px] px-2 py-0.5 rounded bg-surface hover:bg-border text-[#c9d1d9] transition-colors"
          >
            Изменить
          </button>
        )}
      </div>

      {!project ? (
        <EmptyContext engineLabel={engineLabel} />
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Description */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[12px] text-muted leading-snug">
              Правая панель с настройками выбранного проекта {engineLabel}.
            </p>
          </div>

          {/* Context section */}
          <Section icon={<BookOpen size={13} />} title="Контекст проекта">
            {project.system_prompt ? (
              <>
                <Field label="Роль модели" value={project.system_prompt} />
                {project.style && <Field label="Стиль" value={project.style} />}
              </>
            ) : (
              <EmptyField text="Роль и контекст не заданы. Настройте в «Настройках проекта»." />
            )}
          </Section>

          {/* Memory section */}
          <Section icon={<Brain size={13} />} title="Память проекта">
            {editingMemory ? (
              <div className="mt-2">
                <textarea
                  value={memoryText}
                  onChange={(e) => setMemoryText(e.target.value)}
                  rows={6}
                  className="w-full bg-base border border-border rounded px-2.5 py-2 text-[12px] text-white placeholder:text-muted outline-none focus:border-accent resize-none scrollbar-thin"
                  placeholder="Записи, правила, факты для проекта..."
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => updateProject.mutate({ memory: memoryText })}
                    disabled={updateProject.isPending}
                    className="flex-1 text-[12px] py-1 rounded bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setEditingMemory(false)}
                    className="flex-1 text-[12px] py-1 rounded bg-surface hover:bg-border text-[#c9d1d9] transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : project.memory ? (
              <>
                <Field label="Закрепленные правила" value={project.memory} />
                {project.style && (
                  <Field
                    label="Факты проекта"
                    value={`Темы, форматы контента, рабочие ограничения и утверждённые формулировки.`}
                  />
                )}
              </>
            ) : (
              <EmptyField text="Память пуста. Нажмите «Изменить» чтобы добавить правила и факты." />
            )}
          </Section>

          {/* History section */}
          <Section icon={<Clock size={13} />} title="История">
            <EmptyField text="Позже сюда можно вынести последние чаты, закреплённые и быстрый поиск." />
          </Section>

          {/* Footer note */}
          <div className="px-4 py-3 mt-2 border-t border-border">
            <p className="text-[11px] text-muted/70 leading-snug">
              Это отдельная среда {engineLabel}, не связанная с другими AI-модулями.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-muted">{icon}</span>
        <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[12px] font-semibold text-[#c9d1d9] mb-0.5">{label}</div>
      <div className="text-[12px] text-muted leading-snug line-clamp-3">{value}</div>
    </div>
  );
}

function EmptyField({ text }: { text: string }) {
  return <p className="text-[12px] text-muted/70 leading-snug">{text}</p>;
}

function EmptyContext({ engineLabel }: { engineLabel: string }) {
  return (
    <div className="px-4 py-5">
      <div className="flex items-center gap-1.5 mb-2">
        <Edit3 size={13} className="text-muted" />
        <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
          Контекст и память
        </span>
      </div>
      <p className="text-[12px] text-muted leading-snug">
        Правая панель с настройками выбранного проекта {engineLabel}.
      </p>
      <p className="text-[11px] text-muted/60 leading-snug mt-3">
        Выберите или создайте проект, чтобы увидеть его контекст и память.
      </p>
    </div>
  );
}
