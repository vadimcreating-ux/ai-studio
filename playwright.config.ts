import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./apps/tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "e2e-report.json" }]]
    : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: true,
    storageState: "apps/tests/.auth/user.json",
  },

  projects: [
    // Шаг 1: логин — выполняется один раз перед всеми тестами
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { storageState: undefined },
    },
    // Шаг 2: основные тесты — используют сохранённые cookies
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
