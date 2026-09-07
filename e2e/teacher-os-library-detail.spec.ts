import { test, expect, type Page } from "@playwright/test";
import {
  answerKeyPayload,
  homeworkPayload,
  lessonPlanPayload,
  longPrompt,
  longWorksheetPayload,
  quizPayload,
  teacherNotesPayload,
  worksheetPayload,
} from "../src/features/teacher-os/artifacts/artifactFixtures";

const CONTENT_ID = "11111111-1111-1111-1111-111111111111";
const VERSION_ID = "22222222-2222-2222-2222-222222222222";
const WORK_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const ARTIFACTS = [
  {
    contentType: "lesson_plan",
    title: "Fractions lesson",
    payload: lessonPlanPayload,
    expected: ["Learning objectives", "Activate prior knowledge with a pizza model."],
    hidden: ["obj-1", "sec-1"],
  },
  {
    contentType: "worksheet",
    title: "Fractions Worksheet",
    payload: worksheetPayload,
    expected: ["Complete the following questions.", "Which fraction is equivalent to 1/2?"],
    hidden: ["Two quarters equal one half.", "objective_ids"],
  },
  {
    contentType: "quiz",
    title: "Fractions quiz",
    payload: quizPayload,
    expected: ["Quick Quiz", "Is 2/4 equal to 1/2?"],
    hidden: ["They represent the same amount."],
  },
  {
    contentType: "homework",
    title: "Fractions homework",
    payload: homeworkPayload,
    expected: ["Complete at home.", "Shade a model that shows 1/2."],
    hidden: ["Any even numerator/denominator pair can work."],
  },
  {
    contentType: "answer_key",
    title: "Fractions answer key",
    payload: answerKeyPayload,
    expected: ["Answer Key", "Two quarters equal one half.", "Equal parts must be the same size."],
    hidden: ["source_question_id", "q-1"],
  },
  {
    contentType: "teacher_notes",
    title: "Fractions teaching notes",
    payload: teacherNotesPayload,
    expected: ["Watch for common half/quarter confusion."],
    hidden: ["payload_sha256"],
  },
] as const;

function libraryDetail(contentType: string, title: string) {
  return {
    content_id: CONTENT_ID,
    content_type: contentType,
    title,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-02T11:00:00.000Z",
    stewardship_state: "APPROVED",
    current_version_id: VERSION_ID,
    published_version_id: VERSION_ID,
    teaching_work_id: WORK_ID,
    review_navigation: {
      content_id: CONTENT_ID,
      version_id: VERSION_ID,
    },
    aggregate_revision: 4,
  };
}

function libraryVersion(
  contentType: string,
  title: string,
  payload: Record<string, unknown>,
) {
  return {
    ...libraryDetail(contentType, title),
    version_id: VERSION_ID,
    version_number: 1,
    schema_id: `education.${contentType}`,
    schema_version: 1,
    payload,
    payload_sha256: "deadbeef",
    origin: "AI",
  };
}

async function connectDevSessionOnCurrentPage(page: Page) {
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

async function openLibraryArtifact(
  page: Page,
  contentType: string,
  title: string,
  payload: Record<string, unknown>,
) {
  const detail = libraryDetail(contentType, title);
  const version = libraryVersion(contentType, title, payload);
  await page.route("**/api/v1/teacher-os/library/**", async (route) => {
    const url = route.request().url();
    if (url.includes(`/versions/${VERSION_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(version),
      });
      return;
    }
    if (url.includes(`/library/${CONTENT_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail),
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ title: "Not Found", status: 404 }),
    });
  });
  await page.goto(`/teacher-os/library/${CONTENT_ID}`);
  await connectDevSessionOnCurrentPage(page);
  await expect(page.getByTestId("library-artifact")).toBeVisible();
}

test("Library detail renders homework as a teaching document, not JSON", async ({
  page,
}) => {
  await openLibraryArtifact(page, "homework", "Fractions homework", homeworkPayload);
  await expect(
    page.getByRole("heading", { level: 1, name: "Fractions homework" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Preview the published resource and use it in your teaching workflow.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Complete at home.")).toBeVisible();
  await expect(page.getByText("Shade a model that shows 1/2.")).toBeVisible();
  await expect(page.getByText("Two quarters equal one half.")).toHaveCount(0);
  await expect(page.locator("pre.library-payload")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open in Work" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Work$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Review$/ })).toBeVisible();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await expect(page.getByText("APPROVED", { exact: true })).toHaveCount(0);
});

for (const artifact of ARTIFACTS) {
  test(`Library detail renders ${artifact.contentType} without raw JSON`, async ({
    page,
  }) => {
    await openLibraryArtifact(
      page,
      artifact.contentType,
      artifact.title,
      artifact.payload,
    );
    for (const text of artifact.expected) {
      await expect(page.getByText(text).first()).toBeVisible();
    }
    for (const text of artifact.hidden) {
      await expect(page.getByText(text, { exact: true })).toHaveCount(0);
    }
    await expect(page.locator("pre.library-payload")).toHaveCount(0);
    await expect(
      page.getByText(JSON.stringify(artifact.payload, null, 2)),
    ).toHaveCount(0);
  });
}

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`Library worksheet wraps cleanly at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openLibraryArtifact(
      page,
      "worksheet",
      "Long content worksheet",
      longWorksheetPayload,
    );
    await expect(page.locator(".artifact-question-prompt")).toContainText(
      longPrompt,
    );
    const overflow = await page.evaluate(() => {
      const doc = document.querySelector(".artifact-document");
      if (!(doc instanceof HTMLElement)) return true;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
}
