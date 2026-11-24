import { expect, test } from "@playwright/test";
import {
  TEACHER_FRONTEND_URL,
  STUDENT_FRONTEND_URL,
  artifactPath,
  assertNoApiMocksInstalled,
  calendarDateOnlyLocal,
  connectStudentDevSession,
  assertWorksheetHintReviewPanelReady,
  connectTeacherRole,
  loadPkV1HintFixture,
  openStudentPage,
  openTeacherPage,
  preflightReviewerQueueDetail,
  runBackendHintProbes,
  runPersistenceAssert,
  studentApiHeaders,
  teacherApiHeaders,
} from "./support/pkV1HintHarness";

test.describe.configure({ mode: "serial" });

const SAFE_HINT = "Think about matching denominators before you compare.";
const OPEN_ANSWER =
  "Because both show the same amount of the whole.";
const RECORD_NOTE =
  "Class showed mixed evidence on worksheet@2 hint vertical.";
const REMEDIATION_GOAL =
  "Rebuild fraction comparison fluency after worksheet@2 evidence";

const state: {
  hintVersionId: string | null;
  assignmentId: string | null;
  attemptId: string | null;
  submissionId: string | null;
  assessmentId: string | null;
  assessmentRevision: number | null;
  remediationWorkId: string | null;
} = {
  hintVersionId: null,
  assignmentId: null,
  attemptId: null,
  submissionId: null,
  assessmentId: null,
  assessmentRevision: null,
  remediationWorkId: null,
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
    const hintVersionId = state.hintVersionId!;
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);

    await page.goto(`${TEACHER_FRONTEND_URL}/teacher-os/today`);
    await connectTeacherRole(page, "reviewer");

    await preflightReviewerQueueDetail(
      page,
      fixture.content_id,
      hintVersionId,
      fixture.q_open_id,
      "reviewer",
    );

    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/review/${fixture.content_id}/versions/${hintVersionId}`,
    );
    await assertWorksheetHintReviewPanelReady(page);

    const panel = page.getByTestId("worksheet-hint-review");
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

  test("Phase F — Student q-open on-demand hint (no prefetch, fresh GET)", async ({
    browser,
  }) => {
    expect(state.assignmentId).toBeTruthy();
    expect(state.hintVersionId).toBeTruthy();
    const page = await openStudentPage(browser);
    assertNoApiMocksInstalled(page);

    const hintGets: string[] = [];
    page.on("response", (response) => {
      if (
        response.request().method() === "GET" &&
        response.url().includes("/learner-hints")
      ) {
        hintGets.push(response.url());
      }
    });

    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/home`);
    await connectStudentDevSession(page);

    await page
      .locator(`a[href="/student-os/assignments/${state.assignmentId}"]`)
      .click();
    await page.getByRole("button", { name: /^Start$/i }).click();
    await expect(page).toHaveURL(/\/student-os\/attempts\//);
    state.attemptId = page.url().split("/").pop()!;
    expect(state.attemptId).toBeTruthy();
    expect(hintGets).toHaveLength(0);

    const qOpen = page.locator(".sos-question").filter({ hasText: /Q-OPEN/i });
    const showQOpen = qOpen.getByRole("button", {
      name: /Show hint for question 4/i,
    });

    const firstHintPromise = page.waitForResponse(
      (r) =>
        r.request().method() === "GET" &&
        r.url().includes(`/learner-hints`) &&
        r.url().includes(state.attemptId!),
    );
    await showQOpen.click();
    const firstHint = await firstHintPromise;
    expect(firstHint.status()).toBe(200);
    const firstHintJson = (await firstHint.json()) as {
      hints: Array<{ question_id: string; hint_text: string }>;
    };
    expect(firstHintJson.hints).toHaveLength(1);
    expect(firstHintJson.hints[0]?.question_id).toBe(fixture.q_open_id);
    await expect(page.getByText(SAFE_HINT)).toBeVisible();
    expect(page.locator(".sos-learner-hint-outcome").filter({ hasText: SAFE_HINT })).toHaveCount(1);

    const secondHintPromise = page.waitForResponse(
      (r) =>
        r.request().method() === "GET" && r.url().includes("/learner-hints"),
    );
    await showQOpen.click();
    await secondHintPromise;
    expect(hintGets.length).toBeGreaterThanOrEqual(2);

    const detail = await page.request.get(
      `/api/v1/learning/attempts/${state.attemptId}`,
      { headers: studentApiHeaders() },
    );
    const payload = (await detail.json()) as Record<string, unknown>;
    expect(JSON.stringify(payload).toLowerCase()).not.toContain("learner_hint");
    expect(JSON.stringify(payload)).not.toContain(SAFE_HINT);

    await page.context().close();
  });

  test("Phase G — Student save, submit, post-submit hint deny", async ({
    browser,
  }) => {
    expect(state.attemptId).toBeTruthy();
    const page = await openStudentPage(browser);
    assertNoApiMocksInstalled(page);
    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/attempts/${state.attemptId}`);
    await connectStudentDevSession(page);

    const qOpen = page.locator(".sos-question").filter({ hasText: /Q-OPEN/i });
    await qOpen.locator("textarea").fill(OPEN_ANSWER);
    await page.getByRole("button", { name: /Save answers/i }).click();
    await page.getByRole("button", { name: /Submit work/i }).click();
    await page.getByRole("button", { name: /Yes, submit/i }).click();
    await expect(page.getByText(/submitted/i)).toBeVisible();

    const submittedAttempt = await page.request.get(
      `/api/v1/learning/attempts/${state.attemptId}`,
      { headers: studentApiHeaders() },
    );
    const submittedBody = (await submittedAttempt.json()) as {
      lifecycle_state: string;
      submission_id: string | null;
    };
    expect(submittedBody.lifecycle_state).toBe("SUBMITTED");
    state.submissionId = submittedBody.submission_id;

    const denyResponse = await page.request.get(
      `/api/v1/learning/attempts/${state.attemptId}/learner-hints`,
      { headers: studentApiHeaders() },
    );
    expect(denyResponse.status()).toBeGreaterThanOrEqual(400);
    expect(denyResponse.status()).not.toBe(200);
    await expect(page.getByText(SAFE_HINT)).not.toBeVisible();

    runPersistenceAssert("count-evaluations", {
      "tenant-id": fixture.tenant_id,
      "assignment-id": state.assignmentId!,
      "expected-count": 0,
    });
    await page.context().close();
  });

  test("Phase H — Teacher ensure evaluations (@2 exact version)", async ({
    browser,
  }) => {
    expect(state.assignmentId).toBeTruthy();
    expect(state.submissionId).toBeTruthy();
    expect(state.hintVersionId).toBeTruthy();

    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/assess?assignment_id=${state.assignmentId}`,
    );
    await connectTeacherRole(page, "author");
    await expect(page.getByTestId("evaluate-submitted-work")).toBeVisible();

    const ensureResponse = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r
          .url()
          .includes(
            `/api/v1/assessment/assignments/${state.assignmentId}/actions/ensure-evaluations`,
          ) &&
        r.status() === 204,
    );
    await page.getByTestId("evaluate-submitted-work").click();
    await ensureResponse;

    const evaluation = runPersistenceAssert("assert-evaluation", {
      "tenant-id": fixture.tenant_id,
      "assignment-id": state.assignmentId!,
      "submission-id": state.submissionId!,
      "attempt-id": state.attemptId!,
      "learner-principal-id": fixture.student_principal_id,
      "content-id": fixture.content_id,
      "content-version-id": state.hintVersionId!,
    });
    expect(evaluation.evaluation_policy_id).toBe(fixture.evaluation_policy_id);
    const itemOutcomes = evaluation.item_outcomes as Record<string, string>;
    expect(itemOutcomes[fixture.q_open_id]).toBe("OPEN_RESPONSE_UNEVALUATED");
    expect(itemOutcomes[fixture.q_correct_id]).toBe("UNANSWERED");

    await expect(page.getByText(/class score:/i)).toHaveCount(0);
    await expect(page.getByText(/mastery percentage/i)).toHaveCount(0);

    await page.context().close();
  });

  test("Phase I — ClassroomAssessment RECORD + Improve remediation origin", async ({
    browser,
  }) => {
    expect(state.assignmentId).toBeTruthy();
    expect(state.hintVersionId).toBeTruthy();

    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/assess?assignment_id=${state.assignmentId}`,
    );
    await connectTeacherRole(page, "author");
    await page.getByRole("radio", { name: /^Mixed/i }).check();
    await page.getByLabel("Class result note").fill(RECORD_NOTE);

    const recordResponse = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().includes("/api/v1/assessment/classroom-assessments") &&
        !r.url().includes("/actions/") &&
        r.status() === 201,
    );
    await page.getByRole("button", { name: /Record class assessment/i }).click();
    const response = await recordResponse;
    const created = (await response.json()) as {
      assessment_id: string;
      aggregate_revision: number;
      lifecycle_state: string;
    };
    expect(created.lifecycle_state).toBe("RECORDED");
    state.assessmentId = created.assessment_id;
    state.assessmentRevision = created.aggregate_revision;

    const targetDate = calendarDateOnlyLocal(3);
    await page.getByRole("link", { name: /Improve this class/i }).click();
    await page.getByRole("button", { name: /Continue to remediation goal/i }).click();
    await page.getByLabel(/Remediation goal/i).fill(REMEDIATION_GOAL);
    await page.getByRole("button", { name: /Continue to context/i }).click();
    await page.getByLabel(/Target date/i).fill(targetDate);
    await page.getByLabel(/^Subject/i).fill("Mathematics");
    await page.getByLabel(/^Topic/i).fill("Fraction comparison");
    await page.getByRole("button", { name: /Continue to confirm/i }).click();

    const createWorkResponse = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().includes("/from-classroom-assessment") &&
        r.status() === 201,
    );
    await page.getByRole("button", { name: /Create remediation preparation/i }).click();
    const workResponse = await createWorkResponse;
    const workBody = (await workResponse.json()) as { work_id: string };
    state.remediationWorkId = workBody.work_id;
    expect(state.remediationWorkId).toBeTruthy();

    runPersistenceAssert("assert-remediation-origin", {
      "tenant-id": fixture.tenant_id,
      "work-id": state.remediationWorkId!,
      "assessment-id": state.assessmentId!,
      "aggregate-revision": state.assessmentRevision!,
      "class-result-level": "MIXED",
      "class-ref": fixture.class_ref,
      "content-id": fixture.content_id,
      "content-version-id": state.hintVersionId!,
      "assignment-id": state.assignmentId!,
      "teacher-principal-id": fixture.author_principal_id,
    });
    runPersistenceAssert("assert-no-downstream", {
      "tenant-id": fixture.tenant_id,
      "work-id": state.remediationWorkId!,
    });

    await page.context().close();
  });

  test("Phase J — Backend SP02A PostgreSQL HTTP probe bundle", () => {
    const result = runBackendHintProbes();
    expect(result.failed).toBe(0);
    expect(result.passed).toBeGreaterThan(0);
    for (const row of result.lock_scenarios ?? []) {
      expect(row.ok, `lock scenario ${row.scenario_id}`).toBe(true);
    }
  });
});