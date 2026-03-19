import { test, expect } from "@playwright/test";

const ENGINES = [
  { name: "claude",  url: "/claude",  label: "Claude" },
  { name: "chatgpt", url: "/chatgpt", label: "ChatGPT" },
  { name: "gemini",  url: "/gemini",  label: "Gemini" },
] as const;

for (const engine of ENGINES) {
  test.describe(`Chat: ${engine.label}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(engine.url);
      await page.waitForLoadState("networkidle");
    });

    test("отображается 3 панели (проекты / чат / история)", async ({ page }) => {
      // Левая панель — проекты
      await expect(page.getByText(/Проект/i).first()).toBeVisible();
      // Центральная — поле ввода
      await expect(page.locator("textarea")).toBeVisible();
      // Правая — список чатов / история
      await expect(page.getByText(/Новый чат/i).first()).toBeVisible();
    });

    test("поле ввода сообщения активно и принимает текст", async ({ page }) => {
      const textarea = page.locator("textarea").first();
      await textarea.click();
      await textarea.fill("Привет, это E2E тест");
      await expect(textarea).toHaveValue("Привет, это E2E тест");
    });

    test("кнопка создания нового чата видна и кликабельна", async ({ page }) => {
      const btn = page.getByText(/Новый чат/i).first();
      await expect(btn).toBeVisible();
      await btn.click();
      // После клика фокус должен сброситься — чат сбрасывается
      // Просто убеждаемся что не упало
      await expect(page.locator("textarea").first()).toBeVisible();
    });

    test("выбор модели отображается в панели", async ({ page }) => {
      // Селект модели есть в правой панели
      await expect(page.locator("select").first()).toBeVisible();
    });
  });
}

test.describe("Chat: отправка сообщения (Claude)", () => {
  test("отправить сообщение и получить ответ", async ({ page }) => {
    test.setTimeout(60_000); // KIE может отвечать долго

    await page.goto("/claude");
    await page.waitForLoadState("networkidle");

    // Создать новый чат
    await page.getByText(/Новый чат/i).first().click();
    await page.waitForTimeout(500);

    const textarea = page.locator("textarea").first();
    await textarea.fill("Ответь ровно одним словом: тест");

    // Отправить — Enter или кнопка Send
    await textarea.press("Enter");

    // Ждём появления ответа ассистента (роль assistant)
    await expect(
      page.locator('[data-role="assistant"], .message-assistant').first()
    ).toBeVisible({ timeout: 45_000 });
  });
});
