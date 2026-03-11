import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { projectsApi, type Project } from "../../shared/api/projects";

const CLAUDE_MODELS = [
  { value: "claude-opus-4-5", label: "Claude Opus 4.5" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
];

const CHATGPT_MODELS = [
  { value: "gpt-5-2", label: "GPT-5" },
  { value: "gpt-4o", label: "GPT-4o" },
];

const GEMINI_MODELS = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

function getModels(module: string) {
  if (module === "claude") return CLAUDE_MODELS;
  if (module === "chatgpt") return CHATGPT_MODELS;
  return GEMINI_MODELS;
}

type Props = {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
};

export default function ProjectSettingsModal({ project, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: project.name,
    description: project.description,
    model: project.model,
    system_prompt: project.system_prompt,
    style: project.style,
    memory: project.memory,
  });

  const update = useMutation({
    mutationFn: () => projectsApi.update(project.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", project.module] });
      onSaved();
    },
  });

  const models = getModels(project.module);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[520px] max-h-[90vh] bg-panel border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-[15px] font-semibold text-white">Настройки проекта</div>
            <div className="text-[12px] text-muted mt-0.5">{project.name}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
          <Field label="Название проекта">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
            />
          </Field>

          <Field label="Описание">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Краткое описание проекта"
              className="input-field"
            />
          </Field>

          <Field label="Модель">
            <select
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="input-field"
            >
              <option value="">Выбрать модель...</option>
              {models.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Роль модели (System prompt)">
            <textarea
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              rows={4}
              placeholder="Ты — контент-стратег. Помогаешь создавать..."
              className="input-field resize-none"
            />
          </Field>

          <Field label="Стиль общения">
            <input
              value={form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
              placeholder="Понятный, живой, структурный, без перегруза"
              className="input-field"
            />
          </Field>

          <Field label="Память проекта">
            <textarea
              value={form.memory}
              onChange={(e) => setForm({ ...form, memory: e.target.value })}
              rows={5}
              placeholder="Факты, правила, ограничения для этого проекта..."
              className="input-field resize-none"
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={() => update.mutate()}
            disabled={update.isPending || !form.name.trim()}
            className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-medium disabled:opacity-40 transition-colors"
          >
            {update.isPending ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-surface hover:bg-border text-[#c9d1d9] text-[13px] font-medium transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#c9d1d9] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
