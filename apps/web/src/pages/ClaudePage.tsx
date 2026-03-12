import ChatModule from "../modules/chat/ChatModule";

export default function ClaudePage() {
  return (
    <ChatModule
      engine="claude"
      engineLabel="Claude"
      engineDescription="Прямое подключение к Anthropic API. Модели: Haiku (быстрый/дешёвый), Sonnet, Opus."
      defaultModel="claude-haiku-4-5-20251001"
    />
  );
}
