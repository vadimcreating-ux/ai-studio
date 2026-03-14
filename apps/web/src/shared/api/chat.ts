import { api } from "./client";

export type Chat = {
  id: string;
  module: string;
  model: string;
  title: string;
  project_id: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export const chatApi = {
  list: (module: string, project_id?: string) => {
    const params = new URLSearchParams({ module });
    if (project_id) params.set("project_id", project_id);
    return api.get<{ ok: true; chats: Chat[] }>(`/api/chat/list?${params}`);
  },

  create: (data: { module: string; model?: string; title?: string; project_id?: string }) =>
    api.post<{ ok: true; chat: Chat }>("/api/chat/new", data),

  messages: (chatId: string) =>
    api.get<{ ok: true; messages: Message[] }>(`/api/chat/${chatId}/messages`),

  send: (chatId: string, message: string, files?: Array<{ dataUrl: string; mimeType: string; name: string }>) =>
    api.post<{ ok: true; reply: string }>(`/api/chat/${chatId}/send`, { message, files }),

  updateModel: (chatId: string, model: string) =>
    api.patch<{ ok: true; chat: Chat }>(`/api/chat/${chatId}`, { model }),

  rename: (chatId: string, title: string) =>
    api.patch<{ ok: true; chat: Chat }>(`/api/chat/${chatId}`, { title }),

  moveToProject: (chatId: string, projectId: string | null) =>
    api.patch<{ ok: true; chat: Chat }>(`/api/chat/${chatId}`, { project_id: projectId }),

  delete: (chatId: string) =>
    api.delete<{ ok: true }>(`/api/chat/${chatId}`),
};
