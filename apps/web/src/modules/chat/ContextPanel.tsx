import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, BookOpen, Brain } from "lucide-react";
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
    mutationFn: (data: Partial<Project>) => projectsApi.update(project!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", engine] });
      setEditingMemory(false);
    },
  });

  return (
    <div className="flex flex-col w-[280px] min-w-[280px] h-full bg-panel border-l border-border overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
        <div className="text-[14px] font-semibold text-white">Контекст и память</div>
        {project && (
          <button
            onClick={() => { setMemoryText(project.memory || ""); setEditingMemory(true); }}
            className="text-[11px] px-2 py-0.5 rounded bg-surface hover:bg-border text-[#8b949e] hover:text-white transition-colors"
          >
            Изменить
          </button>
        )}
      </div>

      {!project ? (
        <div className="px-4 py-4">
          <p className="text-[12px] text-muted leading-snug">
            Выберите или создайте проект, чтобы увидеть его контекст и память.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[12px] text-muted leading-snug">
              Правая панель с настройками выбранного проекта {engineLabel}.
            </p>
          </div>

          {/* Контекст проекта */}
          <Section icon={<BookOpen size={12} />} title="Контекст проекта">
            {project.system_prompt ? (
              <>
                <SubItem title="Роль модели" value={project.system_prompt} />
                {project.style && <SubItem title="Стиль" value={project.style} />}
              </>
            ) : (
              <p className="text-[12px] text-muted/70 leading-snug">
                Роль и контекст не заданы. Настройте в «Настройках проекта».
              </p>
            )}
          </Section>

          {/* Память проекта */}
          <Section icon={<Brain size={12} />} title="Память проекта">
            {editingMemory ? (
              <div>
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
                    className="flex-1 text-[12px] py-1 rounded bg-surface hover:bg-border text-[#8b949e] transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : project.memory ? (
              <SubItem title="Закрепленные правила" value={project.memory} />
            ) : (
              <p className="text-[12px] text-muted/70 leading-snug">
                Память пуста. Нажмите «Изменить» чтобы добавить правила и факты.
              </p>
            )}
          </Section>

          {/* История */}
          <Section icon={<Clock size={12} />} title="История">
            <SubItem
              title="Быстрый доступ"
              value="Позже сюда можно вынести последние чаты, закреплённые и быстрый поиск."
            />
          </Section>

          <div className="px-4 py-3 mt-1 border-t border-border">
            <p className="text-[11px] text-muted/60 leading-snug">
              Это отдельная среда {engineLabel}, не связанная с другими AI-модулями.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  icon, title, children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-muted">{icon}</span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}

function SubItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="text-[13px] font-semibold text-white mb-0.5">{title}</div>
      <div className="text-[12px] text-muted leading-snug">{value}</div>
    </div>
  );
}
