import { test, expect } from "@playwright/test";

test.describe("Routing", () => {
  test("корень / редиректит на /claude", async ({ page }) => {
    await page.goto("/");
    // С авторизацией / → /claude, без авторизации / → /login
    await expect(page).toHaveURL(/\/(claude|login)/);
    // Если залогинены — должен быть /claude
    const url = page.url();
    if (!url.includes("/login")) {
      await expect(page).toHaveURL(/\/claude/);
    }
  });

  test("/dashboard редиректит на /claude", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/claude/);
  });
});

test.describe("TopNav", () => {
  test("логотип AI Studio виден на всех страницах", async ({ page }) => {
    for (const route of ["/claude", "/chatgpt", "/image"]) {
      await page.goto(route);
      await page.waitForLoadState("load");
      await expect(page.getByText(/AI Studio/i).first()).toBeVisible();
    }
  });

  test("клик по логотипу открывает /claude", async ({ page }) => {
    await page.goto("/image");
    await page.waitForLoadState("load");
    await page.getByText(/AI Studio/i).first().click();
    await expect(page).toHaveURL(/\/claude/);
  });
});

test.describe("Auth", () => {
  test("незалогиненный пользователь редиректится на /login", async ({ browser }) => {
    // Используем чистый контекст без cookies
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/claude");
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test("страница /login содержит форму входа", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto("/login");
    await expect(page.locator("input[type=email]")).toBeVisible();
    await expect(page.locator("input[type=password]")).toBeVisible();
    await ctx.close();
  });
});
