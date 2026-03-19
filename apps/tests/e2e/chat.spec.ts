import { test, expect } from "@playwright/test";

const ENGINES = [
  { name: "claude",  url: "/claude",  label: "Claude" },
  { name: "chatgpt", url: "/chatgpt", label: "ChatGPT" },
  { name: "gemini",  url: "/gemini",  label: "Gemini" },
] as const;

for (const engine of ENGINES) {
  test.describe(`Chat: ${engine.label}`, () => {
    // Запоминаем чаты которые были ДО теста, чтобы удалить только созданные тестом
    let existingChatIds = new Set<string>();

    test.beforeAll(async ({ request }) => {
      const res = await request.get(`/api/chat/list?module=${engine.name}&limit=200`);
      const data = await res.json();
      existingChatIds = new Set((data.chats ?? []).map((c: { id: string }) => c.id));
    });

    test.afterAll(async ({ request }) => {
      const res = await request.get(`/api/chat/list?module=${engine.name}&limit=200`);
      const data = await res.json();
      const testChats = (data.chats ?? []).filter((c: { id: string }) => !existingChatIds.has(c.id));
      for (const chat of testChats) {
        await request.delete(`/api/chat/${chat.id}`).catch(() => {});
      }
    });

    test.beforeEach(async ({ page }) => {
      await page.goto(engine.url);
      await page.waitForLoadState("load");
    });

    test("отображается 3 панели (проекты / чат / история)", async ({ page }) => {
      await expect(page.getByText(/Проект/i).first()).toBeVisible();
      await expect(page.locator("textarea")).toBeVisible();
      await expect(page.getByText(/Новый чат/i).first()).toBeVisible();
    });

    test("поле ввода сообщения активно и принимает текст", async ({ page }) => {
      await page.getByText(/Новый чат/i).first().click();
      await page.waitForTimeout(500);

      const textarea = page.locator("textarea").first();
      await textarea.click();
      await textarea.fill("Привет, это E2E тест");
      await expect(textarea).toHaveValue("Привет, это E2E тест");
    });

    test("кнопка создания нового чата видна и кликабельна", async ({ page }) => {
      const btn = page.getByText(/Новый чат/i).first();
      await expect(btn).toBeVisible();
      await btn.click();
      await expect(page.locator("textarea").first()).toBeVisible();
    });

    test("выбор модели отображается в панели", async ({ page }) => {
      const models: Record<string, RegExp> = {
        claude:  /Claude Sonnet/i,
        chatgpt: /GPT-/i,
        gemini:  /Gemini/i,
      };
      await expect(page.getByText(models[engine.name]).first()).toBeVisible();
    });
  });
}

test.describe("Chat: отправка сообщения (Claude)", () => {
  let existingChatIds = new Set<string>();

  test.beforeAll(async ({ request }) => {
    const res = await request.get(`/api/chat/list?module=claude&limit=200`);
    const data = await res.json();
    existingChatIds = new Set((data.chats ?? []).map((c: { id: string }) => c.id));
  });

  test.afterAll(async ({ request }) => {
    const res = await request.get(`/api/chat/list?module=claude&limit=200`);
    const data = await res.json();
    const testChats = (data.chats ?? []).filter((c: { id: string }) => !existingChatIds.has(c.id));
    for (const chat of testChats) {
      await request.delete(`/api/chat/${chat.id}`).catch(() => {});
    }
  });

  test("отправить сообщение и получить ответ", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/claude");
    await page.waitForLoadState("networkidle");

    await page.getByText(/Новый чат/i).first().click();
    await page.waitForTimeout(500);

    const textarea = page.locator("textarea").first();
    await textarea.fill("Ответь ровно одним словом: тест");
    await textarea.press("Enter");

    await expect(
      page.locator('[data-role="assistant"], .message-assistant').first()
    ).toBeVisible({ timeout: 45_000 });
  });
});
