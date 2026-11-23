import { defineConfig, devices } from "@playwright/test";

const TEACHER_FRONTEND_PORT = Number(
  process.env.PK_V1_HINT_E2E_TEACHER_FRONTEND_PORT || 5191,
);
const STUDENT_FRONTEND_PORT = Number(
  process.env.PK_V1_HINT_E2E_STUDENT_FRONTEND_PORT || 5192,
);
const TEACHER_BACKEND_PORT = Number(
  process.env.PK_V1_HINT_E2E_TEACHER_BACKEND_PORT || 8028,
);
const STUDENT_BACKEND_PORT = Number(
  process.env.PK_V1_HINT_E2E_STUDENT_BACKEND_PORT || 8029,
);

const TEACHER_FRONTEND_URL = `http://127.0.0.1:${TEACHER_FRONTEND_PORT}`;
const STUDENT_FRONTEND_URL = `http://127.0.0.1:${STUDENT_FRONTEND_PORT}`;
const TEACHER_BACKEND_URL = `http://127.0.0.1:${TEACHER_BACKEND_PORT}`;
const STUDENT_BACKEND_URL = `http://127.0.0.1:${STUDENT_BACKEND_PORT}`;

export default defineConfig({
  testDir: "./e2e-pk-v1-hint",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      { open: "never", outputFolder: "playwright-pk-v1-hint-e2e-report" },
    ],
  ],
  globalSetup: "./scripts/pk-v1-hint-e2e/global-setup.mjs",
  use: {
    baseURL: TEACHER_FRONTEND_URL,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: [
    {
      command: "node scripts/pk-v1-hint-e2e/start-teacher-backend.mjs",
      url: `${TEACHER_BACKEND_URL}/docs`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        ...process.env,
        PK_V1_HINT_E2E_TEACHER_BACKEND_PORT: String(TEACHER_BACKEND_PORT),
        PK_V1_HINT_E2E_TEACHER_BACKEND_HOST: "127.0.0.1",
        AIEOS_TEST_PG_PORT: process.env.AIEOS_TEST_PG_PORT || "55439",
      },
    },
    {
      command: "node scripts/pk-v1-hint-e2e/start-student-backend.mjs",
      url: `${STUDENT_BACKEND_URL}/docs`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        ...process.env,
        PK_V1_HINT_E2E_STUDENT_BACKEND_PORT: String(STUDENT_BACKEND_PORT),
        PK_V1_HINT_E2E_STUDENT_BACKEND_HOST: "127.0.0.1",
        AIEOS_TEST_PG_PORT: process.env.AIEOS_TEST_PG_PORT || "55439",
      },
    },
    {
      command: `pnpm exec vite --host 127.0.0.1 --port ${TEACHER_FRONTEND_PORT}`,
      url: TEACHER_FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_DEV_API_PROXY_TARGET: TEACHER_BACKEND_URL,
      },
    },
    {
      command: `pnpm exec vite --host 127.0.0.1 --port ${STUDENT_FRONTEND_PORT}`,
      url: STUDENT_FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_DEV_API_PROXY_TARGET: STUDENT_BACKEND_URL,
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