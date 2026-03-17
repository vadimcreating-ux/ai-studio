import ChatModule from "../modules/chat/ChatModule";

export default function ChatGPTPage() {
  return (
    <ChatModule
      engine="chatgpt"
      engineLabel="ChatGPT"
      engineDescription="Независимый чат-модуль ChatGPT с собственной рабочей средой."
      defaultModel="gpt-5-2"
    />
  );
}
