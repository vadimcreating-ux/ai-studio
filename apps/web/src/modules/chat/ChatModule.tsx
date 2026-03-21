import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type Chat } from "../../shared/api/chat";
import SidePanel from "./SidePanel";
import ChatView from "./ChatView";

type Props = {
  engine: string;
  engineLabel: string;
  engineDescription: string;
  defaultModel: string;
};

export default function ChatModule({ engine, engineLabel, engineDescription, defaultModel }: Props) {
  const qc = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [currentModel, setCurrentModel] = useState(defaultModel);

  const handleSelectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
  }, []);

  const handleSelectChat = useCallback((chat: Chat) => {
    setSelectedChat(chat);
    if (chat.model) setCurrentModel(chat.model);
  }, []);

  const handleNewChat = useCallback(() => setSelectedChat(null), []);

  const handleProjectUpdated = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["projects", engine] });
  }, [qc, engine]);

  const handleModelChange = useCallback((model: string) => {
    setCurrentModel(model);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: unified tree panel */}
      <SidePanel
        engine={engine}
        engineLabel={engineLabel}
        selectedProjectId={selectedProjectId}
        selectedChatId={selectedChat?.id ?? null}
        onSelectProject={handleSelectProject}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        defaultModel={currentModel}
        onModelChange={handleModelChange}
      />

      {/* Center: Chat */}
      <ChatView
        chat={selectedChat}
        project={null}
        engine={engine}
        engineLabel={engineLabel}
        engineDescription={engineDescription}
        onProjectUpdated={handleProjectUpdated}
      />
    </div>
  );
}
