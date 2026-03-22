import ChatModule from "../modules/chat/ChatModule";

export default function ClaudePage() {
  return (
    <ChatModule
      engine="claude"
      engineLabel="Claude"
      engineDescription="Независимый чат-модуль Claude с собственной рабочей средой."
      defaultModel="claude-sonnet-4-5"
    />
  );
}
