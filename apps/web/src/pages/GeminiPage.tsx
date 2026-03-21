import ChatModule from "../modules/chat/ChatModule";

export default function GeminiPage() {
  return (
    <ChatModule
      engine="gemini"
      engineLabel="Gemini"
      engineDescription="Независимый чат-модуль Gemini с отдельной логикой и настройками."
      defaultModel="gemini-2.5-pro"
    />
  );
}
