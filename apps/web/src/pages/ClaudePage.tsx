import ChatModule from "../modules/chat/ChatModule";

export default function ClaudePage() {
  return (
    <ChatModule
      engine="claude"
      engineLabel="Claude"
      engineDescription="Независимый чат-модуль Claude с проектами, контекстом, историей и памятью."
      defaultModel="claude-opus-4-5"
    />
  );
}
