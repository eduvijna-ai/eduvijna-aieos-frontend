import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = Number(process.env.PLAYWRIGHT_PORT || 5182);
const BACKEND_PORT = Number(
  process.env.STUDENT_PRODUCT_E2E_BACKEND_PORT || 8001,
);
const BASE_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

export default defineConfig({
  testDir: "./e2e-student-product",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      { open: "never", outputFolder: "playwright-student-product-report" },
    ],
  ],
  globalSetup: "./scripts/student-product-e2e/global-setup.mjs",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node scripts/student-product-e2e/start-backend.mjs",
      url: `${BACKEND_URL}/docs`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        ...process.env,
        STUDENT_PRODUCT_E2E_BACKEND_PORT: String(BACKEND_PORT),
        STUDENT_PRODUCT_E2E_BACKEND_HOST: "127.0.0.1",
        AIEOS_TEST_PG_PORT: process.env.AIEOS_TEST_PG_PORT || "55434",
      },
    },
    {
      command: `pnpm exec vite --host 127.0.0.1 --port ${FRONTEND_PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_DEV_API_PROXY_TARGET: BACKEND_URL,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
