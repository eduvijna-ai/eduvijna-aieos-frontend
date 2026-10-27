import { expect, test, type Request } from "@playwright/test";
import {
  DEV_TEACHER_PRINCIPAL_ID,
  FORBIDDEN_PARENT_TOKENS,
  FORBIDDEN_PRINCIPAL_TOKENS,
  PARENT_FRONTEND_URL,
  PARENT_OS_HOME_PATH,
  PRINCIPAL_FRONTEND_URL,
  SCHOOL_INTELLIGENCE_PATH,
  STUDENT_FRONTEND_URL,
  TEACHER_FRONTEND_URL,
  artifactPathForIds,
  PASS_KIT_WORKSHEET_PROOF,
  assertNoApiMocksInstalled,
  assertPersistedPassKitWorksheetContract,
  resolveFreshPreparationKitWorksheet,
  assertParentTransportOnly,
  assertPrincipalTransportOnly,
  connectParentDevSession,
  connectPrincipalDevSession,
  connectStudentBDevSession,
  connectStudentDevSession,
  connectTeacherDevSession,
  describeApiRequest,
  fetchTeachingAssignment,
  isApiRequest,
  FRONTEND_I07_BASE_SHA,
  I01R9_SCENARIO_ID,
  calendarDateOnlyLocal,
  loadAieos360Cx01I07Fixture,
  openParentPage,
  openPrincipalPage,
  openStudentPage,
  openTeacherPage,
  parentChildUrl,
  parentHomeUrl,
  parentOsChildPath,
  runPersistenceAssert,
  schoolIntelligenceUrl,
  snapshotPersistence,
  studentApiHeaders,
  studentBApiHeaders,
  teacherApiHeaders,
  type PersistenceSnapshot,
} from "./support/aieos360Cx01I07Harness";

/**
 * AIEOS360-CX01-I07 — integrated client showcase rehearsal guard.
 * Single lineage on I01R9 shared PostgreSQL substrate. Zero Playwright API mocks.
 * DevelopmentCoherentSchoolContextProvider canonical defaults only.
 */
test.describe.configure({ mode: "serial" });

const OPEN_RESPONSE_TEXT =
  "Because both show the same amount of the whole.";
const RECORD_NOTE =
  "Class showed mixed evidence on fraction comparison — teacher judgment.";
const REMEDIATION_GOAL =
  "Rebuild fraction comparison fluency with guided visual models";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const state: {
  assignmentId: string | null;
  attemptId: string | null;
  submissionId: string | null;
  assessmentId: string | null;
  assessmentRevision: number | null;
  remediationWorkId: string | null;
  preReadSnapshot: PersistenceSnapshot | null;
  activeWorkId: string | null;
  activeContentId: string | null;
  activeVersionId: string | null;
  activeWorksheetTitle: string | null;
} = {
  assignmentId: null,
  attemptId: null,
  submissionId: null,
  assessmentId: null,
  assessmentRevision: null,
  remediationWorkId: null,
  preReadSnapshot: null,
  activeWorkId: null,
  activeContentId: null,
  activeVersionId: null,
  activeWorksheetTitle: null,
};

let fixture: ReturnType<typeof loadAieos360Cx01I07Fixture>;

function asRecord(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  expect(Array.isArray(value)).toBe(true);
  return value as unknown[];
}

function assertTokensAbsent(haystack: string, tokens: readonly string[]) {
  const lower = haystack.toLowerCase();
  for (const token of tokens) {
    expect(lower).not.toContain(token.toLowerCase());
  }
}

function assertPrincipalPrivacy(haystack: string) {
  assertTokensAbsent(haystack, FORBIDDEN_PRINCIPAL_TOKENS);
  expect(haystack).not.toContain(OPEN_RESPONSE_TEXT);
  expect(haystack).not.toContain(fixture.student_principal_id);
  expect(haystack).not.toContain(fixture.student_b_principal_id);
  expect(haystack).not.toContain(fixture.teacher_principal_id);
  expect(haystack).not.toContain(fixture.principal_principal_id);
  expect(haystack.toLowerCase()).not.toContain("student a");
  expect(haystack.toLowerCase()).not.toContain("student b");
  expect(haystack.toLowerCase()).not.toContain("teacher leaderboard");
}

function studentQuestionLocator(page: import("@playwright/test").Page, qid: string) {
  return page.locator(".sos-question").filter({ hasText: new RegExp(qid, "i") });
}

function assertParentPrivacy(haystack: string) {
  assertTokensAbsent(haystack, FORBIDDEN_PARENT_TOKENS);
  expect(haystack).not.toContain(OPEN_RESPONSE_TEXT);
  expect(haystack).not.toContain(fixture.teacher_principal_id);
  expect(haystack).not.toContain(fixture.parent_principal_id);
  if (state.activeContentId) {
    expect(haystack).not.toContain(state.activeContentId);
  }
  if (state.activeVersionId) {
    expect(haystack).not.toContain(state.activeVersionId);
  }
  if (state.attemptId) expect(haystack).not.toContain(state.attemptId);
  if (state.submissionId) expect(haystack).not.toContain(state.submissionId);
}

function assignmentLifecycle(value: unknown) {
  const body = asRecord(value);
  return {
    active: body.active,
    closed: body.closed,
    cancelled: body.cancelled,
  };
}

test.describe("[AIEOS360-CX01-I07-E2E] integrated showcase rehearsal", () => {
  test.beforeAll(() => {
    fixture = loadAieos360Cx01I07Fixture();
    expect(fixture.scenario_id).toBe(I01R9_SCENARIO_ID);
    expect(FRONTEND_I07_BASE_SHA).toMatch(/^[0-9a-f]{40}$/);
    runPersistenceAssert("assert-coherent-provider-defaults", {
      "tenant-id": fixture.tenant_id,
    });
  });

  test("Phase A — Teacher Prepare → kit → Review → Approve (deterministic, same run)", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);

    await page.goto(`${TEACHER_FRONTEND_URL}/teacher-os/prepare?showcase=1`);
    await connectTeacherDevSession(page);

    await page
      .getByLabel(/Outcome for this lesson/i)
      .fill("Compare unit fractions using the same whole.");
    await page.getByRole("button", { name: /Continue to context/i }).click();
    await page.getByLabel(/^Class \(optional\)/i).fill("Grade 5A");
    await page.getByLabel(/^Subject \(optional\)/i).fill("Mathematics");
    await page.getByLabel(/^Topic \(optional\)/i).fill("Fraction comparison");
    await page.locator("#prepare-target-date").fill(calendarDateOnlyLocal(2));
    await page.getByRole("button", { name: /Review and confirm/i }).click();
    await page.getByRole("button", { name: /Create preparation/i }).click();
    await expect(page).toHaveURL(/\/teacher-os\/work\//);
    state.activeWorkId = page.url().split("/work/")[1]?.split(/[?#]/)[0] ?? null;
    expect(state.activeWorkId).toBeTruthy();

    await page.getByRole("button", { name: /Create preparation kit/i }).click();
    await expect(
      page.getByText(/Preparation kit created|already exists for this lesson/i),
    ).toBeVisible({ timeout: 120_000 });
    await page.getByRole("link", { name: /Review Worksheet/i }).click();
    await expect(page).toHaveURL(/\/teacher-os\/review\//);
    await page.getByRole("button", { name: /^Approve$/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/teacher-os/work/${state.activeWorkId}(?:[?#]|$)`),
    );

    const workId = state.activeWorkId!;
    const artifacts = await page.request.get(
      `/api/v1/teaching/works/${workId}/artifacts`,
      { headers: teacherApiHeaders() },
    );
    expect(artifacts.ok()).toBeTruthy();
    const items = await artifacts.json();
    const worksheet = resolveFreshPreparationKitWorksheet(
      items,
      workId,
      fixture.content_id,
    );
    expect(worksheet).toBeTruthy();
    state.activeContentId = worksheet!.content_id;
    state.activeVersionId = worksheet!.version_id;
    state.activeWorksheetTitle = worksheet!.title;

    const contentResponse = await page.request.get(
      `/api/v1/contents/${state.activeContentId}`,
      { headers: teacherApiHeaders() },
    );
    expect(contentResponse.ok()).toBeTruthy();
    const contentBody = (await contentResponse.json()) as {
      published_version_id: string | null;
      stewardship_state: string;
    };
    expect(contentBody.stewardship_state).toBe("APPROVED");
    expect(contentBody.published_version_id).not.toBe(state.activeVersionId);
    expect(state.activeContentId).not.toBe(fixture.content_id);
    await assertPersistedPassKitWorksheetContract(
      page.request,
      state.activeContentId!,
      state.activeVersionId!,
    );
    await page.context().close();
  });

  test("Phase B — Teacher Publish + Assign uses coherent School Context", async ({
    browser,
  }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    expect(state.activeWorkId).toBeTruthy();
    expect(state.activeContentId).toBeTruthy();
    expect(state.activeVersionId).toBeTruthy();

    const artifact = artifactPathForIds({
      work_id: state.activeWorkId!,
      content_id: state.activeContentId!,
      version_id: state.activeVersionId!,
    });
    await page.goto(`${TEACHER_FRONTEND_URL}${artifact}`);
    await connectTeacherDevSession(page);

    const contentBefore = await page.request.get(
      `/api/v1/contents/${state.activeContentId}`,
      { headers: teacherApiHeaders() },
    );
    expect(contentBefore.ok()).toBeTruthy();
    const contentBody = (await contentBefore.json()) as {
      published_version_id: string | null;
    };
    if (contentBody.published_version_id !== state.activeVersionId) {
      await page.getByRole("button", { name: "Publish" }).click();
      await expect(
        page.getByText(/Published\. This version is now the published pointer/i),
      ).toBeVisible();
    }

    const classesResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname ===
          "/api/v1/teacher-os/school-context/classes" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "Assign to class" }).click();
    const classesResponse = await classesResponsePromise;
    const classesBody = (await classesResponse.json()) as {
      items: Array<{ class_ref: string; display_label: string }>;
    };
    const grade5a = classesBody.items.find(
      (item) =>
        item.class_ref === "class-5a" && item.display_label === "Grade 5A",
    );
    expect(grade5a).toBeTruthy();
    await page
      .getByRole("combobox", { name: "Class" })
      .selectOption(grade5a!.class_ref);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          "/api/v1/teaching/assignments" &&
        response.status() === 201,
    );
    await page.getByRole("button", { name: "Create assignment" }).click();
    const createResponse = await createResponsePromise;
    await expect(
      page.getByRole("heading", { name: "Assignment created" }),
    ).toBeVisible();
    state.assignmentId = String(
      ((await createResponse.json()) as { assignment_id: string }).assignment_id,
    );

    const durable = await fetchTeachingAssignment(page, state.assignmentId);
    expect(durable.assignment_id).toBe(state.assignmentId);
    expect(durable.audience_type).toBe("class");
    expect(durable.class_ref).toBe("class-5a");
    expect(durable.content_id).toBe(state.activeContentId);
    expect(durable.content_version_id).toBe(state.activeVersionId);
    expect(durable.lifecycle_state).toBe("ACTIVE");
    expect(durable.teacher_principal_id).toBe(DEV_TEACHER_PRINCIPAL_ID);
    expect(durable.source_work_id).toBe(state.activeWorkId);

    await page.context().close();
  });

  test("Phase C — Student A START/SAVE/SUBMIT persists learning facts", async ({
    browser,
  }) => {
    const page = await openStudentPage(browser);
    assertNoApiMocksInstalled(page);
    const f = fixture;
    expect(state.assignmentId).toBeTruthy();

    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/home`);
    await connectStudentDevSession(page);
    await expect(page.getByRole("heading", { name: "Your work" })).toBeVisible();
    const assignmentLink = page.locator(
      `a[href="/student-os/assignments/${state.assignmentId}"]`,
    );
    await expect(assignmentLink).toBeVisible();
    await assignmentLink.click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: state.activeWorksheetTitle!,
      }),
    ).toBeVisible();
    await expect(page.getByText(/copy your teacher assigned/i)).toBeVisible();

    const detailResponse = await page.request.get(
      `/api/v1/student-os/assignments/${state.assignmentId}`,
      { headers: studentApiHeaders() },
    );
    expect(detailResponse.ok()).toBeTruthy();
    const detail = (await detailResponse.json()) as {
      content_version_id: string;
      resource: { title: string };
    };
    expect(detail.content_version_id).toBe(state.activeVersionId);
    expect(detail.resource.title).toBe(state.activeWorksheetTitle);
    await assertPersistedPassKitWorksheetContract(
      page.request,
      state.activeContentId!,
      state.activeVersionId!,
    );

    await page.getByRole("button", { name: /^Start$/i }).click();
    await expect(page).toHaveURL(/\/student-os\/attempts\//);
    state.attemptId = page.url().split("/").pop() ?? null;
    expect(state.attemptId).toBeTruthy();

    const kit = PASS_KIT_WORKSHEET_PROOF;
    await studentQuestionLocator(page, kit.correctMcId)
      .getByRole("radio", { name: kit.correctMcChoice })
      .check();
    await studentQuestionLocator(page, kit.openShortAnswerId)
      .locator("textarea")
      .fill(OPEN_RESPONSE_TEXT);
    await studentQuestionLocator(page, kit.incorrectTrueFalseId)
      .getByRole("radio", { name: kit.incorrectTrueFalseChoice })
      .check();

    await page.getByRole("button", { name: /Save answers/i }).click();
    await expect(page.getByText(/Answers saved/i)).toBeVisible();
    const savedAttempt = await page.request.get(
      `/api/v1/learning/attempts/${state.attemptId}`,
      { headers: studentApiHeaders() },
    );
    expect(savedAttempt.ok()).toBeTruthy();
    const saved = (await savedAttempt.json()) as {
      lifecycle_state: string;
      responses: Array<{
        question_id: string;
        choice_value: string | null;
        boolean_value: boolean | null;
        text_value: string | null;
      }>;
    };
    expect(saved.lifecycle_state).toBe("IN_PROGRESS");
    expect(
      saved.responses.find((item) => item.question_id === kit.correctMcId)
        ?.choice_value,
    ).toBe(kit.correctMcChoice);
    expect(
      saved.responses.find((item) => item.question_id === kit.incorrectTrueFalseId)
        ?.boolean_value,
    ).toBe(false);
    expect(
      saved.responses.find((item) => item.question_id === kit.unansweredMcId),
    ).toBeFalsy();
    expect(
      saved.responses.find((item) => item.question_id === kit.openShortAnswerId)
        ?.text_value,
    ).toBe(OPEN_RESPONSE_TEXT);

    await page.getByRole("button", { name: /Submit work/i }).click();
    await expect(
      page.getByRole("dialog", { name: /Submit this work/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Yes, submit/i }).click();
    await expect(page.getByText(/Work submitted/i)).toBeVisible();

    const submittedAttempt = await page.request.get(
      `/api/v1/learning/attempts/${state.attemptId}`,
      { headers: studentApiHeaders() },
    );
    expect(submittedAttempt.ok()).toBeTruthy();
    const submitted = (await submittedAttempt.json()) as {
      lifecycle_state: string;
      submission_id: string | null;
    };
    expect(submitted.lifecycle_state).toBe("SUBMITTED");
    state.submissionId = submitted.submission_id;
    expect(state.submissionId).toBeTruthy();

    const durable = runPersistenceAssert("assert-durable-learning", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "learner-principal-id": f.student_principal_id,
      "attempt-id": state.attemptId!,
      "submission-id": state.submissionId!,
    });
    expect(durable.attempt_lifecycle_state).toBe("SUBMITTED");
    expect(durable.learner_attempt_count).toBe(1);
    expect(durable.learner_submission_count).toBe(1);

    await page.context().close();
  });

  test("Negative — Student B class-5b cannot discover class-5a assignment", async ({
    browser,
  }) => {
    const page = await openStudentPage(browser);
    assertNoApiMocksInstalled(page);
    expect(state.assignmentId).toBeTruthy();

    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/home`);
    await connectStudentBDevSession(page);
    await expect(page.getByRole("heading", { name: "Your work" })).toBeVisible();
    await expect(
      page.locator(`a[href="/student-os/assignments/${state.assignmentId}"]`),
    ).toHaveCount(0);
    const visible = await page.locator("body").innerText();
    expect(visible).not.toContain(state.assignmentId!);

    const listResponse = await page.request.get(
      "/api/v1/student-os/assignments?limit=20",
      { headers: studentBApiHeaders() },
    );
    expect(listResponse.ok()).toBeTruthy();
    expect(await listResponse.text()).not.toContain(state.assignmentId!);

    const detailResponse = await page.request.get(
      `/api/v1/student-os/assignments/${state.assignmentId}`,
      { headers: studentBApiHeaders() },
    );
    expect(detailResponse.ok()).toBeFalsy();
    expect([401, 403, 404]).toContain(detailResponse.status());

    await page.context().close();
  });

  test("Phase D — explicit assessment evaluates submitted work only", async ({
    browser,
  }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    const f = fixture;
    expect(state.assignmentId).toBeTruthy();
    expect(state.attemptId).toBeTruthy();
    expect(state.submissionId).toBeTruthy();

    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/assess?assignment_id=${state.assignmentId}`,
    );
    await connectTeacherDevSession(page);
    await expect(page.getByTestId("evaluate-submitted-work")).toBeVisible();

    const ensureResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/v1/assessment/assignments/${state.assignmentId}/actions/ensure-evaluations` &&
        response.status() === 204,
    );
    await page.getByTestId("evaluate-submitted-work").click();
    await ensureResponsePromise;
    await expect(page.getByTestId("intelligence-evaluated-count")).toHaveText(
      "1",
    );
    await expect(
      page.getByTestId("learner-state-EVALUATED_UNDER_CURRENT_POLICY"),
    ).toBeVisible();

    const count = runPersistenceAssert("count-evaluations", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "expected-count": 1,
    });
    expect(count.evaluation_count).toBe(1);
    const evaluation = runPersistenceAssert("assert-evaluation", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "submission-id": state.submissionId!,
      "attempt-id": state.attemptId!,
      "learner-principal-id": f.student_principal_id,
      "content-id": state.activeContentId!,
      "content-version-id": state.activeVersionId!,
    });
    expect(evaluation.evaluation_policy_id).toBe(f.evaluation_policy_id);
    expect(evaluation.evaluation_policy_version).toBe(
      f.evaluation_policy_version,
    );
    const kit = PASS_KIT_WORKSHEET_PROOF;
    const itemOutcomes = evaluation.item_outcomes as Record<string, string>;
    expect(itemOutcomes[kit.correctMcId]).toBe("CORRECT");
    expect(itemOutcomes[kit.incorrectTrueFalseId]).toBe("INCORRECT");
    expect(itemOutcomes[kit.unansweredMcId]).toBe("UNANSWERED");
    expect(itemOutcomes[kit.openShortAnswerId]).toBe(
      "OPEN_RESPONSE_UNEVALUATED",
    );
    const objectives = evaluation.objective_results as Record<string, string>;
    expect(objectives[kit.objectiveDemonstratedId]).toBe("INSUFFICIENT_EVIDENCE");
    expect(objectives[kit.objectiveInsufficientId]).toBe("INSUFFICIENT_EVIDENCE");
    await expect(
      page.getByRole("button", { name: /Record class assessment/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Improve this class/i }),
    ).toHaveCount(0);
    await page.context().close();
  });

  test("Phase G — deliberate HUMAN ClassroomAssessment (MIXED)", async ({
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
    await page.getByRole("radio", { name: /^Mixed/i }).check();
    await page.getByLabel("Class result note").fill(RECORD_NOTE);

    const recordResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/assessment/classroom-assessments") &&
        !response.url().includes("/actions/") &&
        response.status() === 201,
    );
    await page.getByRole("button", { name: /Record class assessment/i }).click();
    const response = await recordResponse;
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

    runPersistenceAssert("assert-classroom-assessment", {
      "tenant-id": f.tenant_id,
      "assessment-id": state.assessmentId!,
    });
    runPersistenceAssert("count-evaluations", {
      "tenant-id": f.tenant_id,
      "assignment-id": state.assignmentId!,
      "expected-count": 1,
    });
    await page.context().close();
  });

  test("Phase H — Improve remediation TeachingWork from classroom assessment", async ({
    browser,
  }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    const f = fixture;
    expect(state.assessmentId).toBeTruthy();

    await page.goto(
      `${TEACHER_FRONTEND_URL}/teacher-os/assess?assignment_id=${state.assignmentId}`,
    );
    await connectTeacherDevSession(page);
    await page.getByRole("link", { name: /Improve this class/i }).click();
    await page
      .getByRole("button", { name: /Continue to remediation goal/i })
      .click();
    await page.getByLabel(/Remediation goal/i).fill(REMEDIATION_GOAL);
    await page.getByRole("button", { name: /Continue to context/i }).click();
    await page.getByLabel(/Target date/i).fill(calendarDateOnlyLocal(3));
    await page.getByLabel(/^Subject/i).fill("Mathematics");
    await page.getByLabel(/^Topic/i).fill("Fraction comparison");
    await page.getByRole("button", { name: /Continue to confirm/i }).click();

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
    const response = await createResponse;
    const created = (await response.json()) as {
      work_id: string;
      intent_type: string;
      goal_text: string;
    };
    expect(created.intent_type).toBe("remediate_class");
    expect(created.goal_text).toBe(REMEDIATION_GOAL);
    state.remediationWorkId = created.work_id;

    runPersistenceAssert("assert-remediation-origin", {
      "tenant-id": f.tenant_id,
      "work-id": state.remediationWorkId!,
      "assessment-id": state.assessmentId!,
      "aggregate-revision": state.assessmentRevision!,
      "class-result-level": "MIXED",
      "class-ref": "class-5a",
      "content-id": state.activeContentId!,
      "content-version-id": state.activeVersionId!,
      "assignment-id": state.assignmentId!,
      "teacher-principal-id": f.teacher_principal_id,
    });

    state.preReadSnapshot = snapshotPersistence(f.tenant_id);
    expect(state.preReadSnapshot.learner_assessment_evaluation_count).toBe(1);
    expect(state.preReadSnapshot.classroom_assessment_count).toBe(1);
    await page.context().close();
  });

  test("Negative — mismatched tenant fails closed on assignment read", async ({
    browser,
  }) => {
    const page = await openTeacherPage(browser);
    assertNoApiMocksInstalled(page);
    expect(state.assignmentId).toBeTruthy();
    const wrongTenant = "00000000-0000-4000-8000-000000000001";
    const denied = await page.request.get(
      `/api/v1/teaching/assignments/${state.assignmentId}`,
      {
        headers: {
          ...teacherApiHeaders(),
          "X-AIEOS-Tenant-ID": wrongTenant,
        },
      },
    );
    expect(denied.ok()).toBeFalsy();
    expect([401, 403, 404]).toContain(denied.status());
    await page.context().close();
  });

  test("Phase E — Principal School Intelligence is private and read-only", async ({
    browser,
  }) => {
    const page = await openPrincipalPage(browser);
    assertNoApiMocksInstalled(page);
    expect(state.preReadSnapshot).toBeTruthy();

    const apiRequests: Request[] = [];
    page.on("request", (request) => {
      if (isApiRequest(request)) apiRequests.push(request);
    });
    const intelligencePromise = page.waitForResponse(
      (response) =>
        schoolIntelligenceUrl(response.url()) !== null &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await page.goto(`${PRINCIPAL_FRONTEND_URL}/principal-os`);
    await connectPrincipalDevSession(page);
    const response = await intelligencePromise;
    const url = schoolIntelligenceUrl(response.url());
    expect(url?.pathname).toBe(SCHOOL_INTELLIGENCE_PATH);
    expect(url?.search).toBe("");
    assertPrincipalTransportOnly(response.request(), fixture);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.projection_mode).toBe("DERIVED_ON_REQUEST");
    const summary = asRecord(body.summary);
    expect(summary.in_scope_class_count).toBe(2);
    expect(summary.classes_with_assignment_activity_count).toBe(1);
    expect(summary.teaching_assignment_count).toBe(1);
    expect(summary.learner_submission_count).toBe(1);
    expect(summary.current_policy_evaluation_count).toBe(1);
    expect(assignmentLifecycle(summary.assignment_lifecycle)).toEqual({
      active: 1,
      closed: 0,
      cancelled: 0,
    });

    const classes = asArray(body.classes).map(asRecord);
    expect(classes).toHaveLength(2);
    const class5a = classes.find((item) => item.class_ref === "class-5a");
    const class5b = classes.find((item) => item.class_ref === "class-5b");
    expect(class5a).toBeTruthy();
    expect(class5a!.display_label).toBe("Grade 5A");
    expect(class5a!.has_assignment_activity).toBe(true);
    expect(class5a!.teaching_assignment_count).toBe(1);
    expect(class5a!.learner_submission_count).toBe(1);
    expect(class5a!.current_policy_evaluation_count).toBe(1);
    expect(class5b).toBeTruthy();
    expect(class5b!.display_label).toBe("Grade 5B");
    expect(class5b!.has_assignment_activity).toBe(false);
    expect(class5b!.teaching_assignment_count).toBe(0);
    expect(class5b!.learner_submission_count).toBe(0);
    expect(class5b!.current_policy_evaluation_count).toBe(0);
    assertPrincipalPrivacy(JSON.stringify(body));

    await expect(
      page.getByRole("heading", { name: "School Intelligence" }),
    ).toBeVisible();
    await expect(page.getByText("Authorized classes: 2")).toBeVisible();
    await expect(page.getByTestId("class-card-class-5a")).toContainText(
      "Grade 5A",
    );
    await expect(page.getByTestId("class-card-class-5b")).toContainText(
      "Grade 5B",
    );
    assertPrincipalPrivacy(await page.locator("body").innerText());
    expect(
      apiRequests.every((request) => !MUTATION_METHODS.has(request.method())),
    ).toBe(true);
    expect(apiRequests.map(describeApiRequest).join("\n")).not.toMatch(
      /\b(POST|PUT|PATCH|DELETE)\b/,
    );
    expect(snapshotPersistence(fixture.tenant_id)).toEqual(
      state.preReadSnapshot,
    );
    await page.context().close();
  });

  test("Phase F — Parent sees Student A, conceals Student B, and stays read-only", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const page = await openParentPage(browser);
    assertNoApiMocksInstalled(page);
    expect(state.preReadSnapshot).toBeTruthy();
    expect(state.assignmentId).toBeTruthy();

    const apiRequests: Request[] = [];
    page.on("request", (request) => {
      if (isApiRequest(request)) apiRequests.push(request);
    });
    const homePromise = page.waitForResponse(
      (response) =>
        parentHomeUrl(response.url()) !== null &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await page.goto(`${PARENT_FRONTEND_URL}/parent-os`);
    await connectParentDevSession(page);
    const homeResponse = await homePromise;
    expect(parentHomeUrl(homeResponse.url())?.pathname).toBe(
      PARENT_OS_HOME_PATH,
    );
    assertParentTransportOnly(homeResponse.request(), fixture);
    const homeBody = (await homeResponse.json()) as Record<string, unknown>;
    expect(homeBody.projection_mode).toBe("DERIVED_ON_REQUEST");
    const children = asArray(homeBody.children);
    expect(children).toHaveLength(1);
    const child = asRecord(children[0]);
    expect(child.learner_principal_id).toBe(fixture.student_principal_id);
    expect(child.learner_principal_id).not.toBe(
      fixture.student_b_principal_id,
    );
    const assignments = asArray(child.assignments);
    expect(assignments).toHaveLength(1);
    const assignment = asRecord(assignments[0]);
    expect(assignment.assignment_id).toBe(state.assignmentId);
    expect(assignment.attempt_status).toBe("SUBMITTED");
    expect(assignment.title).toBe(state.activeWorksheetTitle);
    assertParentPrivacy(JSON.stringify(homeBody));
    expect(JSON.stringify(homeBody)).not.toContain(
      fixture.student_b_principal_id,
    );

    await expect(
      page.getByRole("heading", { name: "Family home" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: state.activeWorksheetTitle! }),
    ).toBeVisible();
    await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
    const homeVisible = await page.locator("body").innerText();
    expect(homeVisible).not.toContain(fixture.student_principal_id);
    expect(homeVisible).not.toContain(fixture.student_b_principal_id);
    assertParentPrivacy(homeVisible);

    const childPath = parentOsChildPath(fixture.student_principal_id);
    const childPromise = page.waitForResponse(
      (response) =>
        parentChildUrl(response.url(), fixture.student_principal_id) !== null &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await page
      .getByRole("link", { name: /View all assignments for Child 1/i })
      .click();
    const childResponse = await childPromise;
    expect(parentChildUrl(childResponse.url())?.pathname).toBe(childPath);
    assertParentTransportOnly(childResponse.request(), fixture);
    const childBody = (await childResponse.json()) as Record<string, unknown>;
    const childAssignments = asArray(
      asRecord(asArray(childBody.children)[0]).assignments,
    );
    expect(asRecord(childAssignments[0]).assignment_id).toBe(
      state.assignmentId,
    );
    expect(asRecord(childAssignments[0]).attempt_status).toBe("SUBMITTED");
    assertParentPrivacy(JSON.stringify(childBody));

    const refreshPromise = page.waitForResponse(
      (response) =>
        parentChildUrl(response.url(), fixture.student_principal_id) !== null &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "Refresh" }).click();
    assertParentTransportOnly((await refreshPromise).request(), fixture);

    const hiddenPath = parentOsChildPath(fixture.student_b_principal_id);
    await page.goto(
      `${PARENT_FRONTEND_URL}/parent-os/children/${fixture.student_b_principal_id}`,
    );
    const hiddenPromise = page.waitForResponse(
      (response) =>
        parentChildUrl(response.url(), fixture.student_b_principal_id) !==
          null && response.request().method() === "GET",
    );
    await connectParentDevSession(page);
    const hiddenResponse = await hiddenPromise;
    expect(hiddenResponse.status()).toBe(404);
    expect(parentChildUrl(hiddenResponse.url())?.pathname).toBe(hiddenPath);
    assertParentTransportOnly(hiddenResponse.request(), fixture);
    await expect(
      page.getByRole("heading", { name: "This child is not available." }),
    ).toBeVisible();
    const concealed = await page.locator("body").innerText();
    expect(concealed).not.toContain(fixture.student_b_principal_id);
    expect(concealed.toLowerCase()).not.toContain("student b");
    assertParentPrivacy(concealed);

    expect(
      apiRequests.every((request) => !MUTATION_METHODS.has(request.method())),
    ).toBe(true);
    runPersistenceAssert("assert-no-parent-tables", {
      "tenant-id": fixture.tenant_id,
    });
    expect(snapshotPersistence(fixture.tenant_id)).toEqual(
      state.preReadSnapshot,
    );
    await page.context().close();
  });
});
