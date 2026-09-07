import { test, expect, type Page } from "@playwright/test";

async function connectDevSession(page: Page) {
  await page.goto("/teacher-os/today");
  const details = page.locator("details").filter({
    has: page.locator("summary", { hasText: /DEV session/i }),
  });
  await details.evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await page.locator('input[name="tenantId"]').fill("tenant-e2e");
  await page.locator('input[name="bearerToken"]').fill("e2e-token");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/Connected \(memory only/i)).toBeVisible();
}

function groqProjection() {
  return {
    active_provider_id: "groq",
    active_model_id: "openai/gpt-oss-120b",
    mode: "REAL",
    providers: [
      {
        provider_id: "groq",
        display_name: "Groq",
        configured: true,
        active: true,
        model_id: "openai/gpt-oss-120b",
        development_only: false,
      },
      {
        provider_id: "openai",
        display_name: "OpenAI",
        configured: false,
        active: false,
        model_id: null,
        development_only: false,
      },
      {
        provider_id: "fake",
        display_name: "Development Fake",
        configured: true,
        active: false,
        model_id: "fake-model",
        development_only: true,
      },
    ],
    capability_routes: [
      {
        capability_id: "education.generate_preparation_kit",
        display_name: "Preparation Kit",
        provider_id: "groq",
        model_id: "openai/gpt-oss-120b",
      },
      {
        capability_id: "teacher_os.assistant_respond",
        display_name: "AI Assistant",
        provider_id: "groq",
        model_id: "openai/gpt-oss-120b",
      },
    ],
  };
}

test("Provider Aggregator is a Settings DEV surface, not primary nav", async ({
  page,
}) => {
  await page.route("**/api/v1/teacher-os/today/mission**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mission_date: "2026-09-07",
        review: { pending_count: 0 },
        preparation: { active_work_count: 0, continue_work: null },
        hero_action: { kind: "prepare", work_id: null },
      }),
    });
  });
  await page.route("**/api/v1/teacher-os/memory**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Not found", status: 404 }),
    });
  });
  await page.route("**/api/v1/platform/ai/providers**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(groqProjection()),
    });
  });

  await connectDevSession(page);

  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Provider Aggregator" }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { name: "AI development" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Provider Aggregator" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Provider Aggregator" }),
  ).toBeVisible();
  await expect(page.getByText("REAL AI")).toBeVisible();
  await expect(page.getByText("openai/gpt-oss-120b").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Groq" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "OpenAI" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Capability Routing" }),
  ).toBeVisible();
  await expect(page.getByText("Preparation Kit")).toBeVisible();
  await expect(page.getByLabel(/api key/i)).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
});
