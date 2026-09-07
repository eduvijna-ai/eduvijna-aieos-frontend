import { test, expect } from "@playwright/test";
import {
  assertNoApiMocksInstalled,
  connectDevSession,
  loadProductFixture,
} from "./support/productHarness";

/**
 * TOS-DEV10-I04 Contextual AI Assistant real-stack Product E2E.
 * Zero page.route API mocks — Vite /api proxies to FastAPI with Fake gateway.
 */

test.describe.configure({ mode: "serial" });

const FOCUS_QUESTION = "What should I focus on today?";
const EXPECTED_ANSWER = /Based on today's mission context/i;

test.describe("TOS-DEV10-I04 Teacher OS Assistant Product E2E", () => {
  test.beforeAll(() => {
    loadProductFixture();
  });

  test.beforeEach(({ page }) => {
    assertNoApiMocksInstalled(page);
  });

  test("Phase A — ask focus question via real Backend assistant endpoint", async ({
    page,
  }) => {
    assertNoApiMocksInstalled(page);

    await page.goto("/teacher-os/ai-assistant");
    await connectDevSession(page);
    await expect(
      page.getByRole("heading", { name: "AI Assistant", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Not implemented yet/i)).toHaveCount(0);

    const assistantResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/teacher-os/assistant") &&
        response.ok(),
    );

    await page.getByLabel(/^Message$/i).fill(FOCUS_QUESTION);
    await page.getByRole("button", { name: /^Send$/i }).click();

    const response = await assistantResponse;
    const body = (await response.json()) as {
      answer: string;
      suggested_questions: string[];
      suggested_next_step: string | null;
    };
    expect(body.answer).toMatch(EXPECTED_ANSWER);
    expect(body.suggested_questions.length).toBeGreaterThan(0);

    await expect(page.getByText(EXPECTED_ANSWER)).toBeVisible();
    await expect(page.getByText(FOCUS_QUESTION)).toBeVisible();
  });

  test("Phase B — clear / new conversation resets session-only history", async ({
    page,
  }) => {
    assertNoApiMocksInstalled(page);

    await page.goto("/teacher-os/ai-assistant");
    await connectDevSession(page);

    const firstResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/teacher-os/assistant") &&
        response.ok(),
    );
    await page.getByLabel(/^Message$/i).fill(FOCUS_QUESTION);
    await page.getByRole("button", { name: /^Send$/i }).click();
    await firstResponse;
    await expect(page.getByText(EXPECTED_ANSWER)).toBeVisible();

    await page.getByRole("button", { name: /New conversation/i }).click();
    await expect(page.getByText(EXPECTED_ANSWER)).toHaveCount(0);
    await expect(page.getByText(/Ask a teaching question/i)).toBeVisible();

    const secondResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/teacher-os/assistant") &&
        response.ok(),
    );
    await page.getByLabel(/^Message$/i).fill(FOCUS_QUESTION);
    await page.getByRole("button", { name: /^Send$/i }).click();
    await secondResponse;
    await expect(page.getByText(EXPECTED_ANSWER)).toBeVisible();

    await page.getByRole("button", { name: /Clear conversation/i }).click();
    await expect(page.getByText(EXPECTED_ANSWER)).toHaveCount(0);
    await expect(page.getByText(/Ask a teaching question/i)).toBeVisible();
  });
});
