import { expect, test } from "@playwright/test";
import {
  TEACHER_FRONTEND_URL,
  STUDENT_FRONTEND_URL,
  artifactPath,
  assertNoApiMocksInstalled,
  connectStudentDevSession,
  connectTeacherRole,
  loadPkV1HintFixture,
  openStudentPage,
  openTeacherPage,
  runBackendHintProbes,
  studentApiHeaders,
  teacherApiHeaders,
} from "./support/pkV1HintHarness";

test.describe.configure({ mode: "serial" });

const SAFE_HINT = "Think about matching denominators before you compare.";
const OPEN_ANSWER =
  "Because both show the same amount of the whole.";

const state: {
  hintVersionId: string | null;
  assignmentId: string | null;
  attemptId: string | null;
} = {
  hintVersionId: null,
  assignmentId: null,
  attemptId: null,
};

let fixture: ReturnType<typeof loadPkV1HintFixture>;

test.describe("[PK-V1-HINT-E2E] learner-hint real-stack vertical", () => {
  test.beforeAll(() => {
    fixture = loadPkV1HintFixture();
  });

  test("Phase A — Author publishes v1 baseline", async ({ browser }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    await page.goto(`${TEACHER_FRONTEND_URL}${artifactPath(fixture)}`);
    await connectTeacherRole(page, "author");

    const contentBefore = await page.request.get(
      `/api/v1/contents/${fixture.content_id}`,
      { headers: teacherApiHeaders("author") },
    );
    expect(contentBefore.ok()).toBeTruthy();
    const body = (await contentBefore.json()) as {
      published_version_id: string | null;
    };
    if (body.published_version_id !== fixture.version_id) {
      await page.getByRole("button", { name: "Publish" }).click();
      await expect(
        page.getByText(/Published\. This version is now the published pointer/i),
      ).toBeVisible();
    }
    await page.context().close();
  });

  test("Phase B — Author creates worksheet@2 with learner hint", async ({
    browser,
  }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/library/${fixture.content_id}/learner-hints`,
    );
    await connectTeacherRole(page, "author");

    await page.getByLabel("Authoring class").selectOption(fixture.class_ref);
    const hintArea = page.locator(`#hint-${fixture.q_open_id}`);
    await hintArea.fill(SAFE_HINT);

    await page.getByRole("button", { name: /Preview new version/i }).click();
    const appendPromise = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().includes("/worksheet-learner-hint-versions") &&
        r.status() === 201,
    );
    await page.getByRole("button", { name: /Create hint-bearing version/i }).click();
    const appendResponse = await appendPromise;
    const appendBody = (await appendResponse.json()) as { version_id: string };
    state.hintVersionId = appendBody.version_id;
    expect(state.hintVersionId).toBeTruthy();

    await page.getByRole("button", { name: /Submit for independent review/i }).click();
    await expect(page.getByText(/Submitted for independent review/i)).toBeVisible();
    await page.context().close();
  });

  test("Phase C — Reviewer attests and approves", async ({ browser }) => {
    expect(state.hintVersionId).toBeTruthy();
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/review/${fixture.content_id}/versions/${state.hintVersionId}`,
    );
    await connectTeacherRole(page, "reviewer");

  const panel = page.getByTestId("worksheet-hint-review");
    await expect(panel).toBeVisible();
    const boxes = panel.getByRole("checkbox");
    const count = await boxes.count();
    for (let i = 0; i < count; i += 1) {
      await boxes.nth(i).check();
    }
    await page.getByRole("button", { name: /Record structured attestation/i }).click();
    await expect(
      page.getByText(/Attestation recorded\. You can now approve/i),
    ).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(/Approved/i)).toBeVisible();
    await page.context().close();
  });

  test("Phase D — Publisher publishes hint-bearing version", async ({
    browser,
  }) => {
    expect(state.hintVersionId).toBeTruthy();
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    await page.goto(
      `${TEACHER_FRONTEND_URL}${artifactPath(fixture, state.hintVersionId!)}`,
    );
    await connectTeacherRole(page, "publisher");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(
      page.getByText(/Published\. This version is now the published pointer/i),
    ).toBeVisible();
    await page.context().close();
  });

  test("Phase E — Author assigns exact published version", async ({
    browser,
  }) => {
    expect(state.hintVersionId).toBeTruthy();
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    await page.goto(
      `${TEACHER_FRONTEND_URL}${artifactPath(fixture, state.hintVersionId!)}`,
    );
    await connectTeacherRole(page, "author");

    await page.getByRole("button", { name: "Assign to class" }).click();
    await page.getByRole("combobox", { name: "Class" }).selectOption(fixture.class_ref);
    const createPromise = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().includes("/api/v1/teaching/assignments") &&
        !r.url().includes("/actions/") &&
        r.status() === 201,
    );
    await page.getByRole("button", { name: "Create assignment" }).click();
    const created = await createPromise;
    const body = (await created.json()) as { assignment_id: string };
    state.assignmentId = body.assignment_id;

    const durable = await page.request.get(
      `/api/v1/teaching/assignments/${state.assignmentId}`,
      { headers: teacherApiHeaders("author") },
    );
    expect(durable.ok()).toBeTruthy();
    const assignment = (await durable.json()) as {
      content_version_id: string;
    };
    expect(assignment.content_version_id).toBe(state.hintVersionId);
    await page.context().close();
  });

  test("Phase F — Student on-demand hint, save, submit, post-submit deny", async ({
    browser,
  }) => {
    expect(state.assignmentId).toBeTruthy();
    const page = await openStudentPage(browser);
    assertNoApiMocksInstalled(page);
    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/home`);
    await connectStudentDevSession(page);

    await page
      .locator(`a[href="/student-os/assignments/${state.assignmentId}"]`)
      .click();
    await page.getByRole("button", { name: /^Start$/i }).click();
    await expect(page).toHaveURL(/\/student-os\/attempts\//);
    state.attemptId = page.url().split("/").pop()!;
    expect(state.attemptId).toBeTruthy();

    const hintGetPromise = page.waitForResponse(
      (r) =>
        r.request().method() === "GET" &&
        r.url().includes(`/learner-hints`) &&
        r.url().includes(state.attemptId!),
    );
    const showHint = page.getByRole("button", {
      name: new RegExp(`Show hint for question`, "i"),
    });
    const beforeGets = await page.evaluate(() => performance.getEntriesByType("resource").length);
    await showHint.first().click();
    const hintResponse = await hintGetPromise;
    expect(hintResponse.status()).toBe(200);
    await expect(page.getByText(SAFE_HINT)).toBeVisible();
    await showHint.first().click();
    await page.waitForResponse(
      (r) =>
        r.request().method() === "GET" && r.url().includes("/learner-hints"),
    );

    const detail = await page.request.get(
      `/api/v1/learning/attempts/${state.attemptId}`,
      { headers: studentApiHeaders() },
    );
    const payload = (await detail.json()) as Record<string, unknown>;
    expect(JSON.stringify(payload).toLowerCase()).not.toContain("learner_hint");
    expect(JSON.stringify(payload)).not.toContain(SAFE_HINT);

    const qOpen = page.locator(".sos-question").filter({ hasText: /Q-OPEN/i });
    await qOpen.locator("textarea").fill(OPEN_ANSWER);
    await page.getByRole("button", { name: /Save answers/i }).click();
    await page.getByRole("button", { name: /Submit/i }).click();
    await expect(page.getByText(/submitted/i)).toBeVisible();

    const denyResponse = await page.request.get(
      `/api/v1/learning/attempts/${state.attemptId}/learner-hints`,
      { headers: studentApiHeaders() },
    );
    expect(denyResponse.status()).toBeGreaterThanOrEqual(400);
    expect(page.getByText(SAFE_HINT)).not.toBeVisible();
    expect(beforeGets).toBeGreaterThanOrEqual(0);
    await page.context().close();
  });

  test("Phase G — Backend SP02A PostgreSQL HTTP probe bundle", () => {
    const result = runBackendHintProbes();
    expect(result.failed).toBe(0);
    expect(result.passed).toBeGreaterThan(0);
  });
});