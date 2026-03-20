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

export type ChatListResponse = {
  ok: true;
  chats: Chat[];
  total: number;
  limit: number;
  offset: number;
};

export const chatApi = {
  list: (module: string, project_id?: string, limit = 50, offset = 0) => {
    const params = new URLSearchParams({ module, limit: String(limit), offset: String(offset) });
    if (project_id) params.set("project_id", project_id);
    return api.get<ChatListResponse>(`/api/chat/list?${params}`);
  },

  create: (data: { module: string; model?: string; title?: string; project_id?: string }) =>
    api.post<{ ok: true; chat: Chat }>("/api/chat/new", data),

  messages: (chatId: string) =>
    api.get<{ ok: true; messages: Message[] }>(`/api/chat/${chatId}/messages`),

  send: (chatId: string, message: string, files?: Array<{ dataUrl: string; mimeType: string; name: string }>, webSearch?: boolean) =>
    api.post<{ ok: true; reply: string; credits_spent: number }>(`/api/chat/${chatId}/send`, { message, files, webSearch }),

  updateModel: (chatId: string, model: string) =>
    api.patch<{ ok: true; chat: Chat }>(`/api/chat/${chatId}`, { model }),

  rename: (chatId: string, title: string) =>
    api.patch<{ ok: true; chat: Chat }>(`/api/chat/${chatId}`, { title }),

  moveToProject: (chatId: string, projectId: string | null) =>
    api.patch<{ ok: true; chat: Chat }>(`/api/chat/${chatId}`, { project_id: projectId }),

  delete: (chatId: string) =>
    api.delete<{ ok: true }>(`/api/chat/${chatId}`),

  updateMessage: (chatId: string, messageId: string, content: string) =>
    api.patch<{ ok: true; message: Message }>(`/api/chat/${chatId}/messages/${messageId}`, { content }),

  deleteMessage: (chatId: string, messageId: string) =>
    api.delete<{ ok: true }>(`/api/chat/${chatId}/messages/${messageId}`),

  regenerate: (chatId: string, messageId: string) =>
    api.post<{ ok: true; reply: string; credits_spent: number }>(`/api/chat/${chatId}/messages/${messageId}/regenerate`, {}),
};
