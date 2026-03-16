import ChatModule from "../modules/chat/ChatModule";

export default function ClaudePage() {
  return (
    <ChatModule
      engine="claude"
      engineLabel="Claude"
      engineDescription="Чат с Claude Sonnet — мощный ИИ-ассистент от Anthropic."
      defaultModel=""
    />
  );
}
