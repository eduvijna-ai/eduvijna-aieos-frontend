import { expect, test, type Request, type Response } from "@playwright/test";
import {
  DEV_TEACHER_PRINCIPAL_ID,
  FORBIDDEN_PRINCIPAL_TOKENS,
  PRINCIPAL_FRONTEND_URL,
  SCHOOL_INTELLIGENCE_PATH,
  STUDENT_FRONTEND_URL,
  TEACHER_FRONTEND_URL,
  artifactPath,
  assertNoApiMocksInstalled,
  calendarDateOnlyLocal,
  connectPrincipalDevSession,
  connectStudentDevSession,
  connectTeacherDevSession,
  describeApiRequest,
  fetchTeachingAssignment,
  fetchTeachingWork,
  isApiRequest,
  listClassroomAssessments,
  listTeachingWorkArtifacts,
  loadAieos360S02I04Fixture,
  openPrincipalPage,
  openStudentPage,
  openTeacherPage,
  runPersistenceAssert,
  schoolIntelligenceUrl,
  snapshotPersistence,
  studentApiHeaders,
  teacherApiHeaders,
  type PersistenceSnapshot,
} from "./support/aieos360S02I04Harness";

/**
 * AIEOS360-S02-I04 — Principal OS real-stack School Intelligence journey.
 * Zero Playwright API mocks. Shared PostgreSQL. Three identity surfaces.
 */

test.describe.configure({ mode: "serial" });

const RECORD_NOTE =
  "Class showed mixed evidence on fraction comparison — teacher judgment.";
const REMEDIATION_GOAL =
  "Rebuild fraction comparison fluency with guided visual models";
const OPEN_RESPONSE_TEXT =
  "Because both show the same amount of the whole.";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const state: {
  assignmentId: string | null;
  attemptId: string | null;
  submissionId: string | null;
  assessmentId: string | null;
  assessmentRevision: number | null;
  remediationWorkId: string | null;
  ensureIdempotencyKey: string | null;
  improveIdempotencyKey: string | null;
  prePrincipalSnapshot: PersistenceSnapshot | null;
  postInitialPrincipalSnapshot: PersistenceSnapshot | null;
  postRefreshPrincipalSnapshot: PersistenceSnapshot | null;
  principalBody: Record<string, unknown> | null;
  generatedAt: string | null;
  initialPrincipalApi: string[];
  refreshPrincipalApi: string[];
} = {
  assignmentId: null,
  attemptId: null,
  submissionId: null,
  assessmentId: null,
  assessmentRevision: null,
  remediationWorkId: null,
  ensureIdempotencyKey: null,
  improveIdempotencyKey: null,
  prePrincipalSnapshot: null,
  postInitialPrincipalSnapshot: null,
  postRefreshPrincipalSnapshot: null,
  principalBody: null,
  generatedAt: null,
  initialPrincipalApi: [],
  refreshPrincipalApi: [],
};

let fixture: ReturnType<typeof loadAieos360S02I04Fixture>;

function asRecord(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number {
  expect(typeof value).toBe("number");
  return value as number;
}

function lifecycle(value: unknown) {
  const body = asRecord(value);
  return {
    active: asNumber(body.active),
    closed: asNumber(body.closed),
    cancelled: asNumber(body.cancelled),
  };
}

function coverage(value: unknown) {
  const body = asRecord(value);
  return {
    submitted_count: asNumber(body.submitted_count),
    current_policy_evaluated_count: asNumber(
      body.current_policy_evaluated_count,
    ),
  };
}

function assertForbiddenTokensAbsent(haystack: string) {
  const lower = haystack.toLowerCase();
  for (const token of FORBIDDEN_PRINCIPAL_TOKENS) {
    expect(lower).not.toContain(token.toLowerCase());
  }
  expect(haystack).not.toContain(RECORD_NOTE);
  expect(haystack).not.toContain(OPEN_RESPONSE_TEXT);
  expect(haystack).not.toContain(fixture.student_principal_id);
  expect(haystack).not.toContain(fixture.teacher_principal_id);
  expect(haystack).not.toContain(fixture.principal_principal_id);
}

test.describe("[AIEOS360-S02-I04-E2E] Principal OS real-stack journey", () => {
  test.beforeAll(() => {
    fixture = loadAieos360S02I04Fixture();
  });

  test("Phase A — Teacher Publish + Assign creates durable TeachingAssignment", async ({
    browser,
  }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    const f = fixture;

    await page.goto(`${TEACHER_FRONTEND_URL}${artifactPath(f)}`);
    await connectTeacherDevSession(page);

    const contentBefore = await page.request.get(
      `/api/v1/contents/${f.content_id}`,
      { headers: teacherApiHeaders() },
    );
    expect(contentBefore.ok()).toBeTruthy();
    const contentBody = (await contentBefore.json()) as {
      published_version_id: string | null;
    };
    if (contentBody.published_version_id !== f.version_id) {
      await page.getByRole("button", { name: "Publish" }).click();
      await expect(
        page.getByText(/Published\. This version is now the published pointer/i),
      ).toBeVisible();
    }

    await page.getByRole("button", { name: "Assign to class" }).click();
    await page.getByRole("combobox", { name: "Class" }).selectOption("class-5a");

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/teaching/assignments") &&
        !response.url().includes("/actions/") &&
        response.status() === 201,
    );
    await page.getByRole("button", { name: "Create assignment" }).click();
    const createResponse = await createResponsePromise;
    await expect(
      page.getByRole("heading", { name: "Assignment created" }),
    ).toBeVisible();

    const createdBody = (await createResponse.json()) as {
      assignment_id: string;
    };
    state.assignmentId = createdBody.assignment_id;

    const durable = await fetchTeachingAssignment(page, state.assignmentId!);
    expect(durable.audience_type).toBe("class");
    expect(durable.class_ref).toBe("class-5a");
    expect(durable.content_id).toBe(f.content_id);
    expect(durable.content_version_id).toBe(f.version_id);
    expect(durable.lifecycle_state).toBe("ACTIVE");
    expect(durable.teacher_principal_id).toBe(DEV_TEACHER_PRINCIPAL_ID);
    expect(durable.source_work_id).toBe(f.work_id);

    runPersistenceAssert("count-evaluations", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "expected-count": 0,
    });
    const assessments = await listClassroomAssessments(page, {
      assignmentId: state.assignmentId!,
      limit: 20,
    });
    expect(assessments).toHaveLength(0);

    await page.context().close();
  });

  test("Phase B–C — Student START/SAVE/SUBMIT without automatic evaluation", async ({
    browser,
  }) => {
    const page = await openStudentPage(browser);
    assertNoApiMocksInstalled(page);
    const f = fixture;
    expect(state.assignmentId).toBeTruthy();

    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/home`);
    await connectStudentDevSession(page);
    await expect(page.getByRole("heading", { name: "Your work" })).toBeVisible();
    await expect(
      page.locator(`a[href="/student-os/assignments/${state.assignmentId}"]`),
    ).toBeVisible();

    await page
      .locator(`a[href="/student-os/assignments/${state.assignmentId}"]`)
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: f.worksheet_title }),
    ).toBeVisible();
    await expect(page.getByText(/Assigned version/i)).toBeVisible();

    const detailResponse = await page.request.get(
      `/api/v1/student-os/assignments/${state.assignmentId}`,
      { headers: studentApiHeaders() },
    );
    expect(detailResponse.ok()).toBeTruthy();
    const detail = (await detailResponse.json()) as {
      content_version_id: string;
      resource: { title: string };
    };
    expect(detail.content_version_id).toBe(f.version_id);
    expect(detail.resource.title).toBe(f.worksheet_title);

    await page.getByRole("button", { name: /Start this work/i }).click();
    await expect(page).toHaveURL(/\/student-os\/attempts\//);
    state.attemptId = page.url().split("/").pop()!;
    expect(state.attemptId).toBeTruthy();

    const qCorrect = page
      .locator(".sos-question")
      .filter({ hasText: /Q-CORRECT/i });
    await qCorrect.getByRole("radio", { name: "1/2" }).check();

    const qIncorrect = page
      .locator(".sos-question")
      .filter({ hasText: /Q-INCORRECT/i });
    await qIncorrect.getByRole("radio", { name: "True" }).check();

    const qOpen = page.locator(".sos-question").filter({ hasText: /Q-OPEN/i });
    await qOpen.locator("textarea").fill(OPEN_RESPONSE_TEXT);

    const qFillerA = page
      .locator(".sos-question")
      .filter({ hasText: /Q-FILLER-A/i });
    await qFillerA.getByRole("radio", { name: "1/4" }).check();

    const qFillerB = page
      .locator(".sos-question")
      .filter({ hasText: /Q-FILLER-B/i });
    await qFillerB.getByRole("radio", { name: "True" }).check();

    await page.getByRole("button", { name: /Save answers/i }).click();
    await expect(page.getByText(/Answers saved/i)).toBeVisible();

    const savedAttempt = await page.request.get(
      `/api/v1/learning/attempts/${state.attemptId}`,
      { headers: studentApiHeaders() },
    );
    expect(savedAttempt.ok()).toBeTruthy();
    const savedBody = (await savedAttempt.json()) as {
      lifecycle_state: string;
      responses: Array<{
        question_id: string;
        response_kind: string;
        choice_value: string | null;
        boolean_value: boolean | null;
        text_value: string | null;
      }>;
    };
    expect(savedBody.lifecycle_state).toBe("IN_PROGRESS");
    expect(
      savedBody.responses.find((r) => r.question_id === f.q_correct_id)
        ?.choice_value,
    ).toBe("1/2");
    expect(
      savedBody.responses.find((r) => r.question_id === f.q_incorrect_id)
        ?.boolean_value,
    ).toBe(true);
    expect(
      savedBody.responses.find((r) => r.question_id === f.q_unanswered_id),
    ).toBeFalsy();
    expect(
      savedBody.responses.find((r) => r.question_id === f.q_open_id)?.text_value,
    ).toBe(OPEN_RESPONSE_TEXT);

    await page.getByRole("button", { name: /Submit work/i }).click();
    await expect(
      page.getByRole("dialog", { name: /Submit this work/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Yes, submit/i }).click();
    await expect(page.getByText(/Work submitted/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Save answers/i })).toHaveCount(
      0,
    );

    const submittedAttempt = await page.request.get(
      `/api/v1/learning/attempts/${state.attemptId}`,
      { headers: studentApiHeaders() },
    );
    expect(submittedAttempt.ok()).toBeTruthy();
    const submittedBody = (await submittedAttempt.json()) as {
      lifecycle_state: string;
      submission_id: string | null;
    };
    expect(submittedBody.lifecycle_state).toBe("SUBMITTED");
    expect(submittedBody.submission_id).toBeTruthy();
    state.submissionId = submittedBody.submission_id;

    runPersistenceAssert("count-evaluations", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "expected-count": 0,
    });

    const intelligenceDenied = await page.request.get(
      `/api/v1/assessment/assignments/${state.assignmentId}/intelligence`,
      { headers: studentApiHeaders() },
    );
    expect(intelligenceDenied.ok()).toBeFalsy();
    expect([401, 403, 404, 501, 503]).toContain(intelligenceDenied.status());

    const ensureDenied = await page.request.post(
      `/api/v1/assessment/assignments/${state.assignmentId}/actions/ensure-evaluations`,
      {
        headers: studentApiHeaders({
          "Idempotency-Key": "student-must-not-ensure",
        }),
      },
    );
    expect(ensureDenied.ok()).toBeFalsy();
    expect([401, 403, 404, 501, 503]).toContain(ensureDenied.status());
    expect(ensureDenied.status()).not.toBe(500);

    await page.context().close();
  });

  test("Phase D — Pre-ensure intelligence is READ-only (submitted=1, evaluated=0)", async ({
    browser,
  }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    const f = fixture;
    expect(state.assignmentId).toBeTruthy();

    const mutationPosts: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "POST") return;
      const url = request.url();
      if (
        url.includes("/actions/ensure-evaluations") ||
        url.includes("/actions/evaluate") ||
        url.includes("/api/v1/assessment/classroom-assessments") ||
        url.includes("/from-classroom-assessment")
      ) {
        mutationPosts.push(`${request.method()} ${url}`);
      }
    });

    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/teach/assignments/${state.assignmentId}`,
    );
    await connectTeacherDevSession(page);
    await page
      .getByRole("link", { name: /Review assessment intelligence/i })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/teacher-os/assess\\?assignment_id=${state.assignmentId}`),
    );

    await expect(page.getByTestId("assignment-intelligence-panel")).toBeVisible();
    await expect(page.getByTestId("intelligence-submitted-count")).toHaveText(
      "1",
    );
    await expect(page.getByTestId("intelligence-evaluated-count")).toHaveText(
      "0",
    );
    await expect(page.getByTestId("learner-state-NOT_EVALUATED")).toBeVisible();
    await expect(page.getByTestId("evaluate-submitted-work")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Improve this class/i }),
    ).toHaveCount(0);

    expect(mutationPosts).toEqual([]);
    runPersistenceAssert("assert-classroom-assessment-absent", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
    });
    runPersistenceAssert("count-evaluations", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "expected-count": 0,
    });

    await page.context().close();
  });

  test("Phase E — Explicit Ensure produces one current-policy evaluation", async ({
    browser,
  }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    const f = fixture;
    expect(state.assignmentId).toBeTruthy();
    expect(state.submissionId).toBeTruthy();
    expect(state.attemptId).toBeTruthy();

    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/assess?assignment_id=${state.assignmentId}`,
    );
    await connectTeacherDevSession(page);
    await expect(page.getByTestId("evaluate-submitted-work")).toBeVisible();

    const ensureRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request
          .url()
          .includes(
            `/api/v1/assessment/assignments/${state.assignmentId}/actions/ensure-evaluations`,
          ),
    );
    const ensureResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response
          .url()
          .includes(
            `/api/v1/assessment/assignments/${state.assignmentId}/actions/ensure-evaluations`,
          ) &&
        response.status() === 204,
    );
    await page.getByTestId("evaluate-submitted-work").click();
    const request = await ensureRequest;
    await ensureResponse;
    state.ensureIdempotencyKey = request.headers()["idempotency-key"] ?? null;
    expect(state.ensureIdempotencyKey).toBeTruthy();

    await expect(page.getByTestId("intelligence-submitted-count")).toHaveText(
      "1",
    );
    await expect(page.getByTestId("intelligence-evaluated-count")).toHaveText(
      "1",
    );
    await expect(
      page.getByTestId("learner-state-EVALUATED_UNDER_CURRENT_POLICY"),
    ).toBeVisible();

    const evaluation = runPersistenceAssert("assert-evaluation", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "submission-id": state.submissionId!,
      "attempt-id": state.attemptId!,
      "learner-principal-id": f.student_principal_id,
      "content-id": f.content_id,
      "content-version-id": f.version_id,
    });
    expect(evaluation.evaluation_policy_id).toBe(f.evaluation_policy_id);
    expect(evaluation.evaluation_policy_version).toBe(
      f.evaluation_policy_version,
    );
    const itemOutcomes = evaluation.item_outcomes as Record<string, string>;
    expect(itemOutcomes[f.q_correct_id]).toBe("CORRECT");
    expect(itemOutcomes[f.q_incorrect_id]).toBe("INCORRECT");
    expect(itemOutcomes[f.q_unanswered_id]).toBe("UNANSWERED");
    expect(itemOutcomes[f.q_open_id]).toBe("OPEN_RESPONSE_UNEVALUATED");

    const objectiveResults = evaluation.objective_results as Record<
      string,
      string
    >;
    expect(objectiveResults[f.obj_demonstrated_id]).toBe(
      "DEMONSTRATED_ON_SUBMITTED_ITEMS",
    );
    expect(objectiveResults[f.obj_not_yet_id]).toBe(
      "NOT_YET_DEMONSTRATED_ON_SUBMITTED_ITEMS",
    );
    expect(objectiveResults[f.obj_insufficient_id]).toBe(
      "INSUFFICIENT_EVIDENCE",
    );

    runPersistenceAssert("assert-classroom-assessment-absent", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
    });
    await expect(
      page.getByRole("link", { name: /Improve this class/i }),
    ).toHaveCount(0);

    await page.context().close();
  });

  test("Phase F — Deliberate HUMAN ClassroomAssessment (MIXED)", async ({
    browser,
  }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    const f = fixture;
    expect(state.assignmentId).toBeTruthy();

    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/assess?assignment_id=${state.assignmentId}`,
    );
    await connectTeacherDevSession(page);
    await expect(page.getByTestId("assignment-record-panel")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Record class assessment/i }),
    ).toBeDisabled();

    await page.getByRole("radio", { name: /^Mixed/i }).check();
    await page.getByLabel("Class result note").fill(RECORD_NOTE);

    const recordRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes("/api/v1/assessment/classroom-assessments") &&
        !request.url().includes("/actions/"),
    );
    const recordResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/assessment/classroom-assessments") &&
        !response.url().includes("/actions/") &&
        response.status() === 201,
    );
    await page.getByRole("button", { name: /Record class assessment/i }).click();
    const request = await recordRequest;
    const response = await recordResponse;
    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body.assignment_id).toBe(state.assignmentId);
    expect(body.class_ref).toBe("class-5a");
    expect(body.content_id).toBe(f.content_id);
    expect(body.content_version_id).toBe(f.version_id);
    expect(body.execution_id).toBeNull();
    expect(body.work_id).toBe(f.work_id);
    expect(body.class_result_level).toBe("MIXED");
    expect(body).not.toHaveProperty("learner_id");
    expect(body).not.toHaveProperty("student_id");

    const created = (await response.json()) as {
      assessment_id: string;
      lifecycle_state: string;
      aggregate_revision: number;
      class_result_level: string;
    };
    expect(created.lifecycle_state).toBe("RECORDED");
    expect(created.class_result_level).toBe("MIXED");
    state.assessmentId = created.assessment_id;
    state.assessmentRevision = created.aggregate_revision;

    const durable = runPersistenceAssert("assert-classroom-assessment", {
      "tenant-id": f.tenant_id,
      "assessment-id": state.assessmentId!,
    });
    expect(durable.lifecycle_state).toBe("RECORDED");
    expect(durable.assignment_id).toBe(state.assignmentId);
    expect(durable.class_ref).toBe("class-5a");
    expect(durable.content_id).toBe(f.content_id);
    expect(durable.content_version_id).toBe(f.version_id);
    expect(durable.execution_id).toBeNull();
    expect(durable.work_id).toBe(f.work_id);
    expect(durable.class_result_level).toBe("MIXED");

    runPersistenceAssert("count-evaluations", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "expected-count": 1,
    });

    await page.context().close();
  });

  test("Phase G — Improve/remediation origin with no automatic downstream", async ({
    browser,
  }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    const f = fixture;
    expect(state.assessmentId).toBeTruthy();
    expect(state.assessmentRevision).not.toBeNull();

    const downstreamPosts: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "POST") return;
      const url = request.url();
      if (
        url.includes("/actions/generate") ||
        url.includes("/actions/publish") ||
        url.includes("/api/v1/teaching/assignments") ||
        url.includes("/api/v1/teaching/executions")
      ) {
        downstreamPosts.push(`${request.method()} ${url}`);
      }
    });

    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/assess?assignment_id=${state.assignmentId}`,
    );
    await connectTeacherDevSession(page);
    await expect(
      page.getByRole("link", { name: /Improve this class/i }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Improve this class/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/teacher-os/improve\\?assessment_id=${state.assessmentId}`),
    );
    await expect(
      page.getByRole("heading", { name: /Review the source assessment/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Continue to remediation goal/i })
      .click();
    await page.getByLabel(/Remediation goal/i).fill(REMEDIATION_GOAL);
    await page.getByRole("button", { name: /Continue to context/i }).click();
    const targetDate = calendarDateOnlyLocal(3);
    await page.getByLabel(/Target date/i).fill(targetDate);
    await page.getByLabel(/^Subject/i).fill("Mathematics");
    await page.getByLabel(/^Topic/i).fill("Fraction comparison");
    await page.getByRole("button", { name: /Continue to confirm/i }).click();

    const createRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request
          .url()
          .includes("/api/v1/teaching/works/from-classroom-assessment"),
    );
    const createResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response
          .url()
          .includes("/api/v1/teaching/works/from-classroom-assessment") &&
        response.status() === 201,
    );
    await page
      .getByRole("button", { name: /Create remediation preparation/i })
      .click();
    const request = await createRequest;
    const response = await createResponse;
    state.improveIdempotencyKey = request.headers()["idempotency-key"] ?? null;
    expect(state.improveIdempotencyKey).toBeTruthy();

    const created = (await response.json()) as {
      work_id: string;
      intent_type: string;
      goal_text: string;
    };
    expect(created.intent_type).toBe("remediate_class");
    expect(created.goal_text).toBe(REMEDIATION_GOAL);
    state.remediationWorkId = created.work_id;

    const durableWork = await fetchTeachingWork(page, state.remediationWorkId!);
    expect(durableWork.intent_type).toBe("remediate_class");
    expect(durableWork.goal_text).toBe(REMEDIATION_GOAL);

    const origin = runPersistenceAssert("assert-remediation-origin", {
      "tenant-id": f.tenant_id,
      "work-id": state.remediationWorkId!,
      "assessment-id": state.assessmentId!,
      "aggregate-revision": state.assessmentRevision!,
      "class-result-level": "MIXED",
      "class-ref": "class-5a",
      "content-id": f.content_id,
      "content-version-id": f.version_id,
      "assignment-id": state.assignmentId!,
      "teacher-principal-id": f.teacher_principal_id,
    });
    expect(origin.source_assessment_id).toBe(state.assessmentId);
    expect(origin.source_assessment_id).not.toBe(state.submissionId);
    expect(origin.source_class_ref).toBe("class-5a");
    expect(origin.source_assignment_id).toBe(state.assignmentId);

    const artifacts = await listTeachingWorkArtifacts(
      page,
      state.remediationWorkId!,
    );
    expect(artifacts.items).toHaveLength(0);
    runPersistenceAssert("assert-no-downstream", {
      "tenant-id": f.tenant_id,
      "work-id": state.remediationWorkId!,
    });
    expect(downstreamPosts).toEqual([]);

    await page.context().close();
  });

  test("Principal — real GET School Intelligence, privacy, read-only, no DB mutation", async ({
    browser,
  }) => {
    const f = fixture;
    expect(state.assignmentId).toBeTruthy();
    expect(state.submissionId).toBeTruthy();
    expect(state.assessmentId).toBeTruthy();
    expect(state.remediationWorkId).toBeTruthy();

    state.prePrincipalSnapshot = snapshotPersistence(f.tenant_id);
    expect(state.prePrincipalSnapshot.teaching_assignment_count).toBe(1);
    expect(state.prePrincipalSnapshot.learner_submission_count).toBe(1);
    expect(
      state.prePrincipalSnapshot.learner_assessment_evaluation_count,
    ).toBe(1);
    expect(
      state.prePrincipalSnapshot.recorded_classroom_assessment_count,
    ).toBe(1);
    expect(state.prePrincipalSnapshot.remediation_origin_count).toBe(1);
    expect(
      state.prePrincipalSnapshot.completed_teaching_execution_count,
    ).toBe(0);
    expect(state.prePrincipalSnapshot.teaching_execution_count).toBe(0);

    const page = await openPrincipalPage(browser);
    assertNoApiMocksInstalled(page);

    const apiRequests: Request[] = [];
    const apiResponses: Response[] = [];
    page.on("request", (request) => {
      if (isApiRequest(request)) apiRequests.push(request);
    });
    page.on("response", (response) => {
      if (isApiRequest(response.request())) apiResponses.push(response);
    });

    const intelligenceResponsePromise = page.waitForResponse((response) => {
      const parsed = schoolIntelligenceUrl(response.url());
      return (
        parsed !== null &&
        response.request().method() === "GET" &&
        response.status() === 200
      );
    });

    await page.goto(`${PRINCIPAL_FRONTEND_URL}/principal-os`);
    await connectPrincipalDevSession(page);
    const intelligenceResponse = await intelligenceResponsePromise;
    const requestUrl = schoolIntelligenceUrl(intelligenceResponse.url());
    expect(requestUrl).not.toBeNull();
    expect(intelligenceResponse.request().method()).toBe("GET");
    expect(requestUrl!.pathname).toBe(SCHOOL_INTELLIGENCE_PATH);
    expect(requestUrl!.search).toBe("");
    expect(intelligenceResponse.request().postData()).toBeNull();
    expect(intelligenceResponse.status()).toBe(200);

    const body = (await intelligenceResponse.json()) as Record<
      string,
      unknown
    >;
    state.principalBody = body;
    state.generatedAt = String(body.generated_at);
    expect(Number.isNaN(Date.parse(state.generatedAt))).toBe(false);
    expect(body.projection_mode).toBe("DERIVED_ON_REQUEST");
    const timeWindow = asRecord(body.time_window);
    expect(timeWindow.mode).toBe("CURRENT_FACTS_AS_OF_REQUEST");
    const evaluationPolicy = asRecord(body.evaluation_policy);
    expect(evaluationPolicy.policy_id).toBe(
      "aieos.learner_assessment.deterministic",
    );
    expect(evaluationPolicy.policy_version).toBe(1);

    const summary = asRecord(body.summary);
    expect(summary.in_scope_class_count).toBe(2);
    expect(summary.classes_with_assignment_activity_count).toBe(1);
    expect(summary.teaching_assignment_count).toBe(1);
    expect(lifecycle(summary.assignment_lifecycle)).toEqual({
      active: 1,
      closed: 0,
      cancelled: 0,
    });
    expect(summary.learner_submission_count).toBe(1);
    expect(summary.current_policy_evaluation_count).toBe(1);
    expect(summary.submitted_but_not_current_policy_evaluated_count).toBe(0);
    expect(coverage(summary.evaluation_coverage_among_submitted)).toEqual({
      submitted_count: 1,
      current_policy_evaluated_count: 1,
    });
    expect(summary.classes_with_recorded_classroom_assessment_count).toBe(1);
    expect(
      summary.assignments_with_recorded_classroom_assessment_count,
    ).toBe(1);
    expect(summary.completed_teaching_execution_count).toBe(0);
    expect(summary.remediation_activity_count).toBe(1);

    const classes = body.classes as Array<Record<string, unknown>>;
    expect(classes).toHaveLength(2);
    const grade5a = classes[0]!;
    const grade5b = classes[1]!;
    expect(grade5a.class_ref).toBe("class-5a");
    expect(grade5a.display_label).toBe("Grade 5A");
    expect(grade5a.has_assignment_activity).toBe(true);
    expect(grade5a.teaching_assignment_count).toBe(1);
    expect(lifecycle(grade5a.assignment_lifecycle)).toEqual({
      active: 1,
      closed: 0,
      cancelled: 0,
    });
    expect(grade5a.learner_submission_count).toBe(1);
    expect(grade5a.current_policy_evaluation_count).toBe(1);
    expect(grade5a.submitted_but_not_current_policy_evaluated_count).toBe(0);
    expect(coverage(grade5a.evaluation_coverage_among_submitted)).toEqual({
      submitted_count: 1,
      current_policy_evaluated_count: 1,
    });
    expect(grade5a.has_recorded_classroom_assessment).toBe(true);
    expect(grade5a.assignments_with_recorded_classroom_assessment_count).toBe(
      1,
    );
    expect(grade5a.completed_teaching_execution_count).toBe(0);
    expect(grade5a.remediation_activity_count).toBe(1);

    expect(grade5b.class_ref).toBe("class-5b");
    expect(grade5b.display_label).toBe("Grade 5B");
    expect(grade5b.has_assignment_activity).toBe(false);
    expect(grade5b.teaching_assignment_count).toBe(0);
    expect(lifecycle(grade5b.assignment_lifecycle)).toEqual({
      active: 0,
      closed: 0,
      cancelled: 0,
    });
    expect(grade5b.learner_submission_count).toBe(0);
    expect(grade5b.current_policy_evaluation_count).toBe(0);
    expect(grade5b.submitted_but_not_current_policy_evaluated_count).toBe(0);
    expect(coverage(grade5b.evaluation_coverage_among_submitted)).toEqual({
      submitted_count: 0,
      current_policy_evaluated_count: 0,
    });
    expect(grade5b.has_recorded_classroom_assessment).toBe(false);
    expect(grade5b.assignments_with_recorded_classroom_assessment_count).toBe(
      0,
    );
    expect(grade5b.completed_teaching_execution_count).toBe(0);
    expect(grade5b.remediation_activity_count).toBe(0);

    const responseText = JSON.stringify(body);
    assertForbiddenTokensAbsent(responseText);

    await expect(
      page.getByRole("heading", { name: "School Intelligence" }),
    ).toBeVisible();
    await expect(
      page.getByText(`Current facts as of ${state.generatedAt}`),
    ).toBeVisible();
    await expect(page.getByText("In-scope classes: 2")).toBeVisible();
    await expect(page.getByText(/Derived on request/)).toBeVisible();
    await expect(
      page.getByText(/Current facts as of this request/),
    ).toBeVisible();
    await expect(
      page.getByText("Derived from current authorized AIEOS source domains."),
    ).toBeVisible();
    await expect(
      page.getByLabel("School summary").getByText(
        "Current-policy evaluations: 1 of 1 submitted evidence records",
      ),
    ).toBeVisible();
    await expect(
      page.getByTestId("class-card-class-5a").getByText(
        "Current-policy evaluations: 1 of 1 submitted evidence records",
      ),
    ).toBeVisible();

    const cards = page.locator(".pos-class-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).getByRole("heading", { name: "Grade 5A" })).toBeVisible();
    await expect(cards.nth(1).getByRole("heading", { name: "Grade 5B" })).toBeVisible();
    await expect(page.getByTestId("class-card-class-5a")).toBeVisible();
    await expect(page.getByTestId("class-card-class-5b")).toBeVisible();

    const rendered = (await page.locator("body").innerText()).toLowerCase();
    expect(rendered).not.toContain("%");
    expect(rendered).not.toContain("evaluation rate");
    expect(rendered).not.toContain("submission rate");
    expect(await page.locator("[role=progressbar]").count()).toBe(0);
    expect(rendered).not.toContain("derived_on_request");
    expect(rendered).not.toContain("current_facts_as_of_request");
    expect(rendered).not.toContain("school_context");
    expect(rendered).not.toContain("teaching_assignment");
    expect(rendered).not.toContain("learner_submission");
    expect(rendered).not.toContain("classroom_assessment");
    expect(rendered).not.toContain("teaching_work_remediation_origin");
    assertForbiddenTokensAbsent(await page.locator("body").innerText());

    const schoolIntelligenceGets = apiResponses.filter((response) => {
      const parsed = schoolIntelligenceUrl(response.url());
      return parsed !== null && response.request().method() === "GET";
    });
    expect(schoolIntelligenceGets).toHaveLength(1);
    state.initialPrincipalApi = apiRequests.map(describeApiRequest);
    expect(
      apiRequests.every((request) => !MUTATION_METHODS.has(request.method())),
    ).toBe(true);
    expect(
      apiRequests.every((request) => {
        const url = request.url();
        return (
          !url.includes("ensure-evaluations") &&
          !url.includes("/evaluate") &&
          !url.includes("classroom-assessments") &&
          !url.includes("from-classroom-assessment") &&
          !url.includes("/teaching/assignments") &&
          !url.includes("/teaching/executions")
        );
      }),
    ).toBe(true);

    state.postInitialPrincipalSnapshot = snapshotPersistence(f.tenant_id);
    expect(state.postInitialPrincipalSnapshot).toEqual(
      state.prePrincipalSnapshot,
    );

    const refreshResponsePromise = page.waitForResponse((response) => {
      const parsed = schoolIntelligenceUrl(response.url());
      return (
        parsed !== null &&
        response.request().method() === "GET" &&
        response.status() === 200
      );
    });
    await page.getByRole("button", { name: "Refresh" }).click();
    const refreshResponse = await refreshResponsePromise;
    expect(refreshResponse.request().method()).toBe("GET");
    const refreshUrl = schoolIntelligenceUrl(refreshResponse.url());
    expect(refreshUrl?.pathname).toBe(SCHOOL_INTELLIGENCE_PATH);
    expect(refreshUrl?.search).toBe("");
    expect(refreshResponse.request().postData()).toBeNull();

    const afterRefreshGets = apiResponses.filter((response) => {
      const parsed = schoolIntelligenceUrl(response.url());
      return parsed !== null && response.request().method() === "GET";
    });
    expect(afterRefreshGets).toHaveLength(2);
    state.refreshPrincipalApi = apiRequests.map(describeApiRequest);
    expect(
      apiRequests.every((request) => !MUTATION_METHODS.has(request.method())),
    ).toBe(true);

    state.postRefreshPrincipalSnapshot = snapshotPersistence(f.tenant_id);
    expect(state.postRefreshPrincipalSnapshot).toEqual(
      state.prePrincipalSnapshot,
    );

    await page.context().close();
  });
});
