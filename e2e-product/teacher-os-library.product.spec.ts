import { test, expect } from "@playwright/test";
import {
  apiHeaders,
  artifactPath,
  assertNoApiMocksInstalled,
  connectDevSession,
  loadProductFixture,
} from "./support/productHarness";

/**
 * TOS-DEV10-I02 Library real-stack Product E2E.
 * Zero page.route API mocks — Vite /api proxies to FastAPI.
 * Journey: Work artifact → Review/Publish when needed → Library appears →
 * type/state filters → open → Work navigation. Also unpublished behavior.
 */

test.describe.configure({ mode: "serial" });

let fixture: ReturnType<typeof loadProductFixture>;

async function fetchContent(page: import("@playwright/test").Page) {
  const f = loadProductFixture();
  const response = await page.request.get(`/api/v1/contents/${f.content_id}`, {
    headers: apiHeaders(),
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{
    content_id: string;
    title: string;
    content_type: string;
    published_version_id: string | null;
    current_version_id: string;
    stewardship_state: string;
  }>;
}

async function ensurePublishedExactVersion(
  page: import("@playwright/test").Page,
) {
  const f = loadProductFixture();
  const content = await fetchContent(page);
  if (content.published_version_id === f.version_id) {
    return content;
  }
  await page.goto(artifactPath(f));
  await connectDevSession(page);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(
    page.getByText(/Published\. This version is now the published pointer/i),
  ).toBeVisible();
  const after = await fetchContent(page);
  expect(after.published_version_id).toBe(f.version_id);
  return after;
}

async function listLibrary(
  page: import("@playwright/test").Page,
  params: Record<string, string> = {},
) {
  const response = await page.request.get("/api/v1/teacher-os/library", {
    headers: apiHeaders(),
    params,
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{
    items: Array<{
      content_id: string;
      title: string;
      content_type: string;
      stewardship_state: string;
      published_version_id: string | null;
      teaching_work_id: string | null;
    }>;
    next_cursor: string | null;
  }>;
}

test.beforeAll(() => {
  fixture = loadProductFixture();
});

test.beforeEach(async ({ page }) => {
  assertNoApiMocksInstalled(page);
});

test("Phase A — Publish seed work artifact then Library lists it", async ({
  page,
}) => {
  const content = await ensurePublishedExactVersion(page);
  const listed = await listLibrary(page);
  const hit = listed.items.find((item) => item.content_id === fixture.content_id);
  expect(hit).toBeTruthy();
  expect(hit?.published_version_id).toBe(fixture.version_id);
  expect(hit?.content_type).toBe(content.content_type);

  await page.goto("/teacher-os/library");
  await connectDevSession(page);
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(page.getByRole("heading", { name: content.title })).toBeVisible();
  await expect(page.getByText("Published").first()).toBeVisible();
});

test("Phase B — type and stewardship filters", async ({ page }) => {
  const content = await fetchContent(page);
  await page.goto("/teacher-os/library");
  await connectDevSession(page);
  await page.getByLabelText(/Content type/i).fill(content.content_type);
  await page.getByLabelText(/Stewardship state/i).selectOption("APPROVED");
  await page.getByRole("button", { name: /Apply filters/i }).click();
  await expect(page.getByRole("heading", { name: content.title })).toBeVisible();

  await page.getByLabelText(/Stewardship state/i).selectOption("DRAFT");
  await page.getByRole("button", { name: /Apply filters/i }).click();
  await expect(
    page.getByRole("heading", { name: content.title }),
  ).toHaveCount(0);

  const typed = await listLibrary(page, { content_type: content.content_type });
  expect(
    typed.items.some((item) => item.content_id === fixture.content_id),
  ).toBeTruthy();
  const drafts = await listLibrary(page, { stewardship_state: "DRAFT" });
  expect(
    drafts.items.some((item) => item.content_id === fixture.content_id),
  ).toBeFalsy();
});

test("Phase C — open published item and navigate to Work", async ({ page }) => {
  const content = await fetchContent(page);
  await page.goto("/teacher-os/library");
  await connectDevSession(page);
  const row = page
    .locator("li.panel")
    .filter({ has: page.getByRole("heading", { name: content.title }) });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: /^Open$/i }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/teacher-os/work/${fixture.work_id}/artifacts/${fixture.content_id}/versions/${fixture.version_id}`,
    ),
  );
  await page.goto("/teacher-os/library");
  await connectDevSession(page);
  await row.getByRole("link", { name: /^Work$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher-os/work/${fixture.work_id}`));
});

test("Phase D — unpublished item remains visible without published marker", async ({
  page,
}) => {
  const create = await page.request.post("/api/v1/contents", {
    headers: {
      ...apiHeaders(),
      "Idempotency-Key": crypto.randomUUID(),
    },
    data: {
      content_type: fixture.content_type,
      title: "Library unpublished draft",
      description: "Unpublished library E2E item",
      locale: "en",
    },
  });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as { content_id: string; title: string };

  const listed = await listLibrary(page);
  const draft = listed.items.find((item) => item.content_id === created.content_id);
  expect(draft).toBeTruthy();
  expect(draft?.published_version_id).toBeNull();
  expect(draft?.stewardship_state).toBe("DRAFT");

  await page.goto("/teacher-os/library");
  await connectDevSession(page);
  const row = page
    .locator("li.panel")
    .filter({ has: page.getByRole("heading", { name: created.title }) });
  await expect(row).toBeVisible();
  await expect(row.getByText("Not published")).toBeVisible();
  await expect(row.getByText("DRAFT")).toBeVisible();

  await page.getByLabelText(/Published only/i).check();
  await page.getByRole("button", { name: /Apply filters/i }).click();
  await expect(
    page.getByRole("heading", { name: created.title }),
  ).toHaveCount(0);
});
