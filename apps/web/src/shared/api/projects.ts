import { api } from "./client";

export type ProjectFile = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type Project = {
  id: string;
  module: string;
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  style: string;
  memory: string;
  context_files: ProjectFile[];
  created_at: string;
};

export const projectsApi = {
  list: (module: string) =>
    api.get<{ ok: true; projects: Project[] }>(`/api/projects?module=${module}`),

  create: (data: {
    module: string;
    name: string;
    description?: string;
    model?: string;
    system_prompt?: string;
    style?: string;
    memory?: string;
  }) => api.post<{ ok: true; project: Project }>("/api/projects", data),

  update: (
    id: string,
    data: Partial<Omit<Project, "id" | "module" | "created_at">>
  ) => api.put<{ ok: true; project: Project }>(`/api/projects/${id}`, data),

  delete: (id: string) =>
    api.delete<{ ok: true }>(`/api/projects/${id}`),
};
