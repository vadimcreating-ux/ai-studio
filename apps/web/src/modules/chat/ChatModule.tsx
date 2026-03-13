import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi, type Project } from "../../shared/api/projects";
import { type Chat } from "../../shared/api/chat";
import ProjectsPanel from "./ProjectsPanel";
import ChatView from "./ChatView";
import PromptsPanel from "./PromptsPanel";

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
  const [insertText, setInsertText] = useState<string | null>(null);

  const { data: projectsData } = useQuery({
    queryKey: ["projects", engine],
    queryFn: () => projectsApi.list(engine),
  });

  const selectedProject: Project | null =
    projectsData?.projects.find((p) => p.id === selectedProjectId) ?? null;

  const handleSelectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    setSelectedChat(null);
  }, []);

  const handleSelectChat = useCallback((chat: Chat) => setSelectedChat(chat), []);
  const handleNewChat = useCallback(() => setSelectedChat(null), []);
  const handleProjectUpdated = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["projects", engine] });
  }, [qc, engine]);

  return (
    <div className="flex h-full overflow-hidden">
      <ProjectsPanel
        engine={engine}
        engineLabel={engineLabel}
        engineDescription={engineDescription}
        selectedProjectId={selectedProjectId}
        selectedChatId={selectedChat?.id ?? null}
        onSelectProject={handleSelectProject}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        defaultModel={defaultModel}
      />
      <ChatView
        chat={selectedChat}
        project={selectedProject}
        engineLabel={engineLabel}
        engineDescription={engineDescription}
        insertText={insertText}
        onInsertConsumed={() => setInsertText(null)}
        onProjectUpdated={handleProjectUpdated}
      />
      <PromptsPanel onInsert={(text) => setInsertText(text)} />
    </div>
  );
}
