import { test, expect } from "@playwright/test";

test.describe("Dashboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("загружается dashboard с заголовком", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /KIE AI Studio/i })).toBeVisible();
  });

  test("отображаются карточки чат-движков", async ({ page }) => {
    // Карточки движков — <button> элементы с exact text
    await expect(page.getByRole("button", { name: "Claude" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ChatGPT" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gemini" })).toBeVisible();
  });

  test("отображаются карточки медиа", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Image" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Video" })).toBeVisible();
  });

  test("клик по Claude открывает /claude", async ({ page }) => {
    // Карточки — <button> с navigate(), не ссылки
    await page.getByRole("button", { name: "Claude" }).click();
    await expect(page).toHaveURL(/\/claude/);
  });

  test("клик по ChatGPT открывает /chatgpt", async ({ page }) => {
    await page.getByRole("button", { name: "ChatGPT" }).click();
    await expect(page).toHaveURL(/\/chatgpt/);
  });

  test("клик по Gemini открывает /gemini", async ({ page }) => {
    await page.getByRole("button", { name: "Gemini" }).click();
    await expect(page).toHaveURL(/\/gemini/);
  });

  test("клик по Image открывает /image", async ({ page }) => {
    await page.getByRole("button", { name: "Image" }).click();
    await expect(page).toHaveURL(/\/image/);
  });

  test("клик по Video открывает /video", async ({ page }) => {
    await page.getByRole("button", { name: "Video" }).click();
    await expect(page).toHaveURL(/\/video/);
  });
});

test.describe("TopNav", () => {
  test("логотип AI Studio виден на всех страницах", async ({ page }) => {
    for (const route of ["/dashboard", "/claude", "/chatgpt", "/image"]) {
      await page.goto(route);
      await page.waitForLoadState("load");
      await expect(page.getByText(/AI Studio/i).first()).toBeVisible();
    }
  });

  test("переход на /dashboard по логотипу", async ({ page }) => {
    await page.goto("/claude");
    await page.waitForLoadState("load");
    await page.getByText(/AI Studio/i).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("NavBar ссылки ведут на правильные страницы", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /Image/i }).first().click();
    await expect(page).toHaveURL(/\/image/);

    await page.getByRole("link", { name: /Video/i }).first().click();
    await expect(page).toHaveURL(/\/video/);
  });

  test("корень / редиректит на /dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
