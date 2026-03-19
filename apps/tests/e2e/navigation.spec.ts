import { test, expect } from "@playwright/test";

test.describe("Routing", () => {
  test("корень / редиректит на /claude", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/claude/);
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

  test("NavBar ссылки ведут на правильные страницы", async ({ page }) => {
    await page.goto("/claude");
    await page.waitForLoadState("load");

    await page.getByRole("link", { name: /Image/i }).first().click();
    await expect(page).toHaveURL(/\/image/);

    await page.getByRole("link", { name: /Video/i }).first().click();
    await expect(page).toHaveURL(/\/video/);
  });
});
