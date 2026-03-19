#!/usr/bin/env npx tsx
/**
 * Удаляет тестовые чаты оставшиеся от smoke/E2E тестов.
 *
 * Удаляет чаты с заголовком "Новый чат" у которых нет сообщений
 * (такие чаты создают E2E тесты и бросают их).
 * Дополнительно удаляет smoke-test чаты по префиксу "[smoke-test]".
 *
 * Запуск:
 *   TEST_URL=https://your-app.com npm run cleanup:test-chats
 *   TEST_URL=http://localhost:3000 npm run cleanup:test-chats
 */

const BASE_URL = (process.env.TEST_URL || "http://localhost:3000").replace(/\/$/, "");
const ENGINES = ["claude", "chatgpt", "gemini"];

async function apiGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function apiDelete(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE" });
  return res.ok;
}

async function main() {
  console.log(`\nCleanup test chats`);
  console.log(`URL: ${BASE_URL}\n`);

  let totalDeleted = 0;

  for (const engine of ENGINES) {
    const data = await apiGet(`/api/chat/list?module=${engine}&limit=200`);
    const chats = (data.chats ?? []) as Array<{ id: string; title: string }>;

    for (const chat of chats) {
      const isSmoke = chat.title.startsWith("[smoke-test]");
      const isEmptyDefault = chat.title === "Новый чат";

      if (!isSmoke && !isEmptyDefault) continue;

      // Для "Новый чат" проверяем что нет сообщений — не удаляем чаты с реальными диалогами
      if (isEmptyDefault) {
        const msgData = await apiGet(`/api/chat/${chat.id}/messages`);
        const messages = (msgData.messages ?? []) as unknown[];
        if (messages.length > 0) continue; // пользователь что-то написал — не трогаем
      }

      const ok = await apiDelete(`/api/chat/${chat.id}`);
      if (ok) {
        console.log(`  ✓ Удалён [${engine}] "${chat.title}" (${chat.id})`);
        totalDeleted++;
      } else {
        console.log(`  ✗ Не удалось удалить [${engine}] "${chat.title}" (${chat.id})`);
      }
    }
  }

  console.log(`\nИтого удалено: ${totalDeleted} тестовых чатов`);
}

main().catch((e) => {
  console.error("Ошибка:", e);
  process.exit(1);
});
