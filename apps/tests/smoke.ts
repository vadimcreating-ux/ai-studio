#!/usr/bin/env npx tsx
/**
 * Smoke-тесты AI Studio
 *
 * Запуск:
 *   TEST_URL=https://your-app.com npm run test:smoke
 *   TEST_URL=http://localhost:3000 npm run test:smoke
 *
 * По умолчанию: http://localhost:3000
 */

const BASE_URL = (process.env.TEST_URL || "http://localhost:3000").replace(/\/$/, "");
const TIMEOUT_MS = 60_000; // 60s на KIE-вызовы (gemini-2.5-pro бывает медленным)

// ─── Типы ────────────────────────────────────────────────────────────────────

type TestResult = {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
};

// ─── Утилиты ─────────────────────────────────────────────────────────────────

const results: TestResult[] = [];
const cleanup: Array<() => Promise<void>> = [];

// Глобальный cookie для авторизованных запросов
let authCookie = "";

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs });
    console.log(`  ✓  ${name} (${durationMs}ms)`);
  } catch (e) {
    const durationMs = Date.now() - start;
    const error = e instanceof Error ? e.message : String(e);
    results.push({ name, passed: false, durationMs, error });
    console.log(`  ✗  ${name} (${durationMs}ms)`);
    console.log(`     └─ ${error}`);
  }
}

async function api(method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
  const hasBody = body !== undefined;
  const headers: Record<string, string> = {};
  if (hasBody) headers["Content-Type"] = "application/json";
  if (authCookie) headers["Cookie"] = authCookie;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  let data: Record<string, unknown>;
  try {
    data = await res.json() as Record<string, unknown>;
  } catch {
    throw new Error(`HTTP ${res.status} — не JSON-ответ`);
  }

  if (!res.ok || data.ok === false) {
    throw new Error(String(data.error ?? `HTTP ${res.status}`));
  }
  return data;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// ─── Тест-группы ─────────────────────────────────────────────────────────────

async function runAuthSetup() {
  console.log("\n── Auth Setup ───────────────────────────────────────────");

  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    console.log("  ⚠  TEST_EMAIL / TEST_PASSWORD не заданы — пропускаем авторизованные тесты");
    console.log("     Задай переменные: TEST_EMAIL=... TEST_PASSWORD=... npm run test:smoke");
    return false;
  }

  let loginOk = false;
  await test("POST /api/auth/login — авторизация тестового пользователя", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });
    const setCookie = res.headers.get("set-cookie");
    const data = await res.json() as Record<string, unknown>;
    assert(res.ok && data.ok === true, `Логин упал: ${data.error ?? res.status}`);
    assert(!!setCookie, "нет set-cookie в ответе");
    // Извлечь auth_token=... из set-cookie
    const match = setCookie.match(/auth_token=[^;]+/);
    assert(!!match, "нет auth_token в cookie");
    authCookie = match![0];
    loginOk = true;
  });

  return loginOk;
}

async function runHealthTests() {
  console.log("\n── Health & Status ──────────────────────────────────────");

  await test("GET /health — сервер отвечает", async () => {
    const data = await api("GET", "/health");
    assert(data.ok === true, "ok !== true");
  });

  await test("GET /api/kie-balance — KIE API доступен (admin)", async () => {
    const data = await api("GET", "/api/kie-balance");
    assert(data.ok === true, "ok !== true");
    assert(typeof (data as Record<string, unknown>).balance !== "undefined" ||
           typeof (data as Record<string, unknown>).data !== "undefined",
      "нет данных баланса");
  });
}

async function runSettingsTests() {
  console.log("\n── Engine Settings ──────────────────────────────────────");

  for (const engine of ["claude", "chatgpt", "gemini"]) {
    await test(`GET /api/engine-settings/${engine}`, async () => {
      const data = await api("GET", `/api/engine-settings/${engine}`);
      assert(data.ok === true, "ok !== true");
    });
  }
}

async function runProjectsTests() {
  console.log("\n── Projects ─────────────────────────────────────────────");

  await test("GET /api/projects — список проектов", async () => {
    const data = await api("GET", "/api/projects");
    assert(data.ok === true, "ok !== true");
    assert(Array.isArray(data.projects), "projects не массив");
  });
}

async function runChatTests(module: string, model: string) {
  console.log(`\n── Chat: ${module} (${model}) ────────────────────────────`);

  let chatId: string | null = null;

  await test(`POST /api/chat/new [${module}] — создать чат`, async () => {
    const data = await api("POST", "/api/chat/new", {
      module,
      model,
      title: `[smoke-test] ${module}`,
    });
    assert(data.ok === true, "ok !== true");
    const chat = data.chat as Record<string, unknown>;
    assert(typeof chat?.id === "string", "нет chat.id");
    chatId = chat.id as string;

    // Зарегистрировать очистку — выполнится даже если тест упадёт
    cleanup.push(async () => {
      if (chatId) {
        await fetch(`${BASE_URL}/api/chat/${chatId}`, { method: "DELETE" }).catch(() => {});
      }
    });
  });

  if (!chatId) {
    console.log(`  ⚠  Пропускаем остальные тесты ${module} — чат не создан`);
    return;
  }

  await test(`GET /api/chat/list?module=${module} — список чатов`, async () => {
    const data = await api("GET", `/api/chat/list?module=${module}`);
    assert(data.ok === true, "ok !== true");
    assert(Array.isArray(data.chats), "chats не массив");
    const chats = data.chats as Array<Record<string, unknown>>;
    assert(chats.some((c) => c.id === chatId), "новый чат не найден в списке");
  });

  await test(`GET /api/chat/${chatId}/messages — история сообщений`, async () => {
    const data = await api("GET", `/api/chat/${chatId}/messages`);
    assert(data.ok === true, "ok !== true");
    assert(Array.isArray(data.messages), "messages не массив");
  });

  let replyText: string | null = null;

  await test(`POST /api/chat/${chatId}/send — отправить сообщение → KIE`, async () => {
    const data = await api("POST", `/api/chat/${chatId}/send`, {
      message: "Ответь ровно одним словом: тест",
    });
    assert(data.ok === true, "ok !== true");
    assert(typeof data.reply === "string" && (data.reply as string).length > 0, "пустой reply");
    replyText = data.reply as string;
  });

  if (replyText) {
    await test(`GET /api/chat/${chatId}/messages — история содержит 2 сообщения`, async () => {
      const data = await api("GET", `/api/chat/${chatId}/messages`);
      const messages = data.messages as Array<Record<string, unknown>>;
      assert(messages.length === 2, `ожидалось 2 сообщения, получили ${messages.length}`);
      assert(messages[0].role === "user", "первое сообщение не user");
      assert(messages[1].role === "assistant", "второе сообщение не assistant");
    });

    // Тест редактирования сообщения
    await test(`PATCH /api/chat/${chatId}/messages/:id — редактировать сообщение`, async () => {
      const histData = await api("GET", `/api/chat/${chatId}/messages`);
      const messages = histData.messages as Array<Record<string, unknown>>;
      const userMsg = messages.find((m) => m.role === "user") as Record<string, unknown> | undefined;
      assert(!!userMsg, "нет user-сообщения");
      const data = await api("PATCH", `/api/chat/${chatId}/messages/${userMsg!.id}`, {
        content: "Ответь ровно одним словом: тест (edited)",
      });
      assert(data.ok === true, "ok !== true");
    });

    // Тест удаления сообщения
    await test(`DELETE /api/chat/${chatId}/messages/:id — удалить сообщение`, async () => {
      const histData = await api("GET", `/api/chat/${chatId}/messages`);
      const messages = histData.messages as Array<Record<string, unknown>>;
      const assistantMsg = messages.find((m) => m.role === "assistant") as Record<string, unknown> | undefined;
      assert(!!assistantMsg, "нет assistant-сообщения");
      const data = await api("DELETE", `/api/chat/${chatId}/messages/${assistantMsg!.id}`);
      assert(data.ok === true, "ok !== true");
    });
  }

  await test(`DELETE /api/chat/${chatId} — удалить тестовый чат`, async () => {
    const data = await api("DELETE", `/api/chat/${chatId}`);
    assert(data.ok === true, "ok !== true");
    chatId = null; // уже удалён, не нужно удалять в cleanup
  });
}

async function runImageTests() {
  console.log("\n── Image ────────────────────────────────────────────────");

  await test("POST /api/image/improve-prompt — улучшение промпта (KIE GPT)", async () => {
    const data = await api("POST", "/api/image/improve-prompt", {
      prompt: "кот на диване",
    });
    assert(data.ok === true, "ok !== true");
    assert(
      typeof data.improvedPrompt === "string" && (data.improvedPrompt as string).length > 0,
      "пустой improvedPrompt"
    );
  });

  await test("POST /api/image/translate-prompt — перевод промпта (KIE GPT)", async () => {
    const data = await api("POST", "/api/image/translate-prompt", {
      prompt: "красивый закат над горами",
    });
    assert(data.ok === true, "ok !== true");
    assert(
      typeof data.translatedPrompt === "string" && (data.translatedPrompt as string).length > 0,
      "пустой translatedPrompt"
    );
  });
}

// ─── Итоговый отчёт ───────────────────────────────────────────────────────────

function printReport(totalMs: number): {
  passed: number;
  failed: number;
  total: number;
  totalMs: number;
  results: TestResult[];
} {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log("\n─────────────────────────────────────────────────────────");
  console.log(`Итого: ${passed}/${total} прошло, ${failed} упало | ${totalMs}ms`);

  if (failed > 0) {
    console.log("\nПровалившиеся тесты:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  ✗  ${r.name}\n     ${r.error}`));
  }

  return { passed, failed, total, totalMs, results };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nAI Studio Smoke Tests`);
  console.log(`URL: ${BASE_URL}`);
  console.log(`Время: ${new Date().toISOString()}`);

  const start = Date.now();

  try {
    // Health не требует авторизации
    await test("GET /health — сервер отвечает", async () => {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(10_000) });
      const data = await res.json() as Record<string, unknown>;
      assert(data.ok === true, "ok !== true");
    });

    // Логин — все последующие тесты требуют авторизации
    const loggedIn = await runAuthSetup();
    if (!loggedIn) {
      console.log("\n⚠  Пропускаем все тесты требующие авторизации");
      return;
    }

    await runHealthTests();
    await runSettingsTests();
    await runProjectsTests();
    await runChatTests("claude",  "claude-sonnet-4-5");
    await runChatTests("chatgpt", "gpt-5-2");
    await runChatTests("gemini",  "gemini-2.5-pro");
    await runImageTests();
  } finally {
    // Cleanup: удалить тестовые данные даже при ошибках
    for (const fn of cleanup) {
      await fn();
    }
  }

  const totalMs = Date.now() - start;
  const report = printReport(totalMs);

  // JSON-отчёт для анализатора (шаг 2)
  const reportPath = `smoke-report-${Date.now()}.json`;
  await import("fs").then((fs) =>
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  );
  console.log(`\nОтчёт сохранён: ${reportPath}`);

  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Критическая ошибка:", e);
  process.exit(1);
});
