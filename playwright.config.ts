import { defineConfig, devices } from "@playwright/test";

const webBaseUrl = process.env.E2E_WEB_URL ?? "http://127.0.0.1:5173";
const apiBaseUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  outputDir: "test-results",
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width: 390 },
      },
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-mobile",
      use: {
        ...devices["iPhone 13"],
        viewport: { height: 844, width: 390 },
      },
    },
    {
      name: "desktop-1440",
      use: {
        browserName: "chromium",
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: "mobile-375",
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
        isMobile: true,
        viewport: { height: 812, width: 375 },
      },
    },
    {
      name: "mobile-430",
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
        isMobile: true,
        viewport: { height: 932, width: 430 },
      },
    },
  ],
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  retries: process.env.CI ? 2 : 0,
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL: webBaseUrl,
    locale: "zh-CN",
    screenshot: "only-on-failure",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/start-e2e-services.mjs",
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
      E2E_ADMIN_PASSWORD:
        process.env.E2E_ADMIN_PASSWORD ?? "E2eAdminPassword123!",
      E2E_LOCAL_STORAGE_DIR:
        process.env.E2E_LOCAL_STORAGE_DIR ?? "output/e2e/storage",
    },
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 300_000,
    url: `${apiBaseUrl}/api/v1/health`,
  },
});
