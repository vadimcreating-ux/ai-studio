import { api } from "./client";

export type EngineSettings = {
  engine: string;
  about: string;
  instructions: string;
  memory: string;
};

export const engineSettingsApi = {
  get: (engine: string) =>
    api.get<{ ok: true; settings: EngineSettings }>(`/api/engine-settings/${engine}`),

  save: (engine: string, data: Omit<EngineSettings, "engine">) =>
    api.put<{ ok: true; settings: EngineSettings }>(`/api/engine-settings/${engine}`, data),
};
