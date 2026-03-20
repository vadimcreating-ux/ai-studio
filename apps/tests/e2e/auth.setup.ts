import { test as setup } from "@playwright/test";

const AUTH_FILE = "apps/tests/.auth/user.json";

/**
 * Global auth setup — логинится один раз и сохраняет cookies.
 * Требует переменных: TEST_EMAIL, TEST_PASSWORD
 * По умолчанию использует первого зарегистрированного пользователя (admin).
 */
setup("authenticate", async ({ request }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Укажи TEST_EMAIL и TEST_PASSWORD для E2E тестов.\n" +
      "Пример: TEST_EMAIL=admin@example.com TEST_PASSWORD=12345678 npm run test:e2e"
    );
  }

  const res = await request.post("/api/auth/login", {
    data: { email, password },
  });

  if (!res.ok()) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Логин упал (${res.status()}): ${body.error ?? "неизвестная ошибка"}`);
  }

  // Сохранить cookies из request-контекста (именно там они после POST /api/auth/login)
  await request.storageState({ path: AUTH_FILE });
});
