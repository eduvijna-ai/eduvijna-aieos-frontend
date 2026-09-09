import { expect, test } from "@playwright/test";
import {
  DEV_TEACHER_PRINCIPAL_ID,
  STUDENT_FRONTEND_URL,
  TEACHER_FRONTEND_URL,
  artifactPath,
  assertNoApiMocksInstalled,
  calendarDateOnlyLocal,
  connectStudentDevSession,
  connectTeacherDevSession,
  fetchTeachingAssignment,
  fetchTeachingWork,
  listClassroomAssessments,
  listTeachingWorkArtifacts,
  loadAieos360I05Fixture,
  openStudentPage,
  openTeacherPage,
  runPersistenceAssert,
  studentApiHeaders,
  teacherApiHeaders,
} from "./support/aieos360I05Harness";

/**
 * AIEOS360-S01-I05-E2E — REAL STUDENT → ASSESSMENT → TEACHER → IMPROVE
 * Zero page.route API mocks. Shared PostgreSQL. Two identity surfaces.
 */

test.describe.configure({ mode: "serial" });

const RECORD_NOTE =
  "Class showed mixed evidence on fraction comparison — teacher judgment.";
const REMEDIATION_GOAL =
  "Rebuild fraction comparison fluency with guided visual models";
const OPEN_RESPONSE_TEXT =
  "Because both show the same amount of the whole.";

const state: {
  assignmentId: string | null;
  attemptId: string | null;
  submissionId: string | null;
  assessmentId: string | null;
  assessmentRevision: number | null;
  remediationWorkId: string | null;
  ensureIdempotencyKey: string | null;
  improveIdempotencyKey: string | null;
} = {
  assignmentId: null,
  attemptId: null,
  submissionId: null,
  assessmentId: null,
  assessmentRevision: null,
  remediationWorkId: null,
  ensureIdempotencyKey: null,
  improveIdempotencyKey: null,
};

let fixture: ReturnType<typeof loadAieos360I05Fixture>;

test.describe("[AIEOS360-S01-I05-E2E] Real student→assessment→teacher→improve", () => {
  test.beforeAll(() => {
    fixture = loadAieos360I05Fixture();
  });

  test("Phase A — Teacher Assign creates durable TeachingAssignment", async ({
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

  test("Phase B–C — Student sees assignment, START, respond, SUBMIT", async ({
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

    // X. SUBMIT must not auto-evaluate
    runPersistenceAssert("count-evaluations", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "expected-count": 0,
    });

    // Student surface must not gain Teacher Assessment Intelligence
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

  test("Phase E–F — Explicit ensure + exact evaluation semantics", async ({
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

    await expect(page.getByTestId("frequently-missed-item")).toHaveText(
      new RegExp(f.q_incorrect_id),
    );
    await expect(page.getByTestId("frequently-missed-item")).not.toHaveText(
      new RegExp(f.q_unanswered_id),
    );
    await expect(
      page.getByTestId(`unanswered-${f.q_unanswered_id}`),
    ).toHaveText("1");
    await expect(page.getByTestId("intelligence-unanswered-count")).toHaveText(
      "1",
    );

    await expect(page.getByText(/class score:/i)).toHaveCount(0);
    await expect(page.getByText(/mastery percentage/i)).toHaveCount(0);
    await expect(page.getByText(/not-submitted/i)).toHaveCount(0);
    await expect(page.getByText(/average grade/i)).toHaveCount(0);
    await expect(
      page.getByText(/not a class score, not mastery/i),
    ).toBeVisible();

    runPersistenceAssert("assert-classroom-assessment-absent", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
    });
    await expect(
      page.getByRole("link", { name: /Improve this class/i }),
    ).toHaveCount(0);

    await page.context().close();
  });

  test("Phase G — Deliberate HUMAN ClassroomAssessment (MIXED)", async ({
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

    // ClassroomAssessment must not rewrite LearnerAssessmentEvaluation
    runPersistenceAssert("count-evaluations", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "expected-count": 1,
    });

    await page.context().close();
  });

  test("Phase H–J — Improve handoff + immutable remediation origin + no expansion", async ({
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
});
