import { test, expect } from "@playwright/test";

test.describe("Image page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/image");
    await page.waitForLoadState("networkidle");
  });

  test("страница загружается без ошибок", async ({ page }) => {
    await expect(page).toHaveURL(/\/image/);
    // Нет диалога с текстом ошибки
    await expect(page.getByText(/Ошибка/i)).not.toBeVisible();
  });

  test("видно поле ввода промпта", async ({ page }) => {
    await expect(page.locator("textarea").first()).toBeVisible();
  });

  test("видна кнопка Сгенерировать", async ({ page }) => {
    await expect(page.getByText(/Сгенерировать/i).first()).toBeVisible();
  });

  test("видна кнопка Улучшить промпт", async ({ page }) => {
    await expect(page.getByText(/Улучшить/i).first()).toBeVisible();
  });

  test("видна кнопка Перевести", async ({ page }) => {
    await expect(page.getByText(/Перевести/i).first()).toBeVisible();
  });

  test("виден список проектов (левая панель)", async ({ page }) => {
    await expect(page.getByText(/Проект/i).first()).toBeVisible();
  });

  test("виден селектор модели", async ({ page }) => {
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("поле промпта принимает текст", async ({ page }) => {
    const textarea = page.locator("textarea").first();
    await textarea.fill("красивый закат над горами");
    await expect(textarea).toHaveValue("красивый закат над горами");
  });

  test("Улучшить промпт вызывает API и обновляет поле", async ({ page }) => {
    test.setTimeout(30_000);

    const textarea = page.locator("textarea").first();
    await textarea.fill("кот");

    const improveBtn = page.getByText(/Улучшить/i).first();
    await improveBtn.click();

    // Ждём изменения значения в textarea (prompting KIE)
    await expect(textarea).not.toHaveValue("кот", { timeout: 25_000 });
    const newValue = await textarea.inputValue();
    expect(newValue.length).toBeGreaterThan(3);
  });
});

test.describe("Video page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/video");
    await page.waitForLoadState("networkidle");
  });

  test("страница загружается без ошибок", async ({ page }) => {
    await expect(page).toHaveURL(/\/video/);
    await expect(page.getByText(/Ошибка/i)).not.toBeVisible();
  });

  test("видно поле ввода промпта", async ({ page }) => {
    await expect(page.locator("textarea").first()).toBeVisible();
  });

  test("видна кнопка Сгенерировать", async ({ page }) => {
    await expect(page.getByText(/Сгенерировать/i).first()).toBeVisible();
  });

  test("видны кнопки улучшения промпта", async ({ page }) => {
    await expect(page.getByText(/Улучшить/i).first()).toBeVisible();
    await expect(page.getByText(/Перевести/i).first()).toBeVisible();
  });

  test("видна левая панель с проектами и моделями", async ({ page }) => {
    await expect(page.getByText(/Проект/i).first()).toBeVisible();
    await expect(page.locator("select").first()).toBeVisible();
  });
});
