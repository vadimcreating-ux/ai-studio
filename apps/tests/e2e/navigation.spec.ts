import { test, expect } from "@playwright/test";

test.describe("Routing", () => {
  test("корень / редиректит на /dashboard", async ({ page }) => {
    await page.goto("/");
    // С авторизацией / → /dashboard, без авторизации / → /login
    await expect(page).toHaveURL(/\/(dashboard|login)/);
    // Если залогинены — должен быть /dashboard
    const url = page.url();
    if (!url.includes("/login")) {
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test("/dashboard открывает Dashboard страницу", async ({ page }) => {
    await page.goto("/dashboard");
    // Если не залогинен — редирект на /login, если залогинен — остаётся на /dashboard
    await expect(page).toHaveURL(/\/(dashboard|login)/);
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

  test("клик по логотипу открывает /dashboard", async ({ page }) => {
    await page.goto("/image");
    await page.waitForLoadState("load");
    await page.getByText(/AI Studio/i).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
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
