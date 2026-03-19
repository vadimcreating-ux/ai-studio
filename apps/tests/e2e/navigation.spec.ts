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
    await expect(page.getByText("Claude")).toBeVisible();
    await expect(page.getByText("ChatGPT")).toBeVisible();
    await expect(page.getByText("Gemini")).toBeVisible();
  });

  test("отображаются карточки медиа", async ({ page }) => {
    await expect(page.getByText("Image")).toBeVisible();
    await expect(page.getByText("Video")).toBeVisible();
  });

  test("клик по Claude открывает /claude", async ({ page }) => {
    await page.getByRole("link", { name: /Claude/i }).first().click();
    await expect(page).toHaveURL(/\/claude/);
  });

  test("клик по ChatGPT открывает /chatgpt", async ({ page }) => {
    await page.getByRole("link", { name: /ChatGPT/i }).first().click();
    await expect(page).toHaveURL(/\/chatgpt/);
  });

  test("клик по Gemini открывает /gemini", async ({ page }) => {
    await page.getByRole("link", { name: /Gemini/i }).first().click();
    await expect(page).toHaveURL(/\/gemini/);
  });

  test("клик по Image открывает /image", async ({ page }) => {
    await page.getByRole("link", { name: /Image/i }).first().click();
    await expect(page).toHaveURL(/\/image/);
  });

  test("клик по Video открывает /video", async ({ page }) => {
    await page.getByRole("link", { name: /Video/i }).first().click();
    await expect(page).toHaveURL(/\/video/);
  });
});

test.describe("TopNav", () => {
  test("логотип AI Studio виден на всех страницах", async ({ page }) => {
    for (const route of ["/dashboard", "/claude", "/chatgpt", "/image"]) {
      await page.goto(route);
      await expect(page.getByText(/AI Studio/i).first()).toBeVisible();
    }
  });

  test("переход на /dashboard по логотипу", async ({ page }) => {
    await page.goto("/claude");
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
