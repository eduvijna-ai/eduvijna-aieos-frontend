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
  artifactPath,
  assertNoApiMocksInstalled,
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
  loadAieos360S04I03Fixture,
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
} from "./support/aieos360S04I03Harness";

/**
 * AIEOS360-S04-I03 — integrated cross-role real-stack journey.
 * Zero Playwright API mocks. Shared PostgreSQL.
 * DevelopmentCoherentSchoolContextProvider canonical defaults only.
 * No harness-local School Context authority maps.
 */
test.describe.configure({ mode: "serial" });

const OPEN_RESPONSE_TEXT =
  "Because both show the same amount of the whole.";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const state: {
  assignmentId: string | null;
  attemptId: string | null;
  submissionId: string | null;
  preReadSnapshot: PersistenceSnapshot | null;
} = {
  assignmentId: null,
  attemptId: null,
  submissionId: null,
  preReadSnapshot: null,
};

let fixture: ReturnType<typeof loadAieos360S04I03Fixture>;

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

function assertParentPrivacy(haystack: string) {
  assertTokensAbsent(haystack, FORBIDDEN_PARENT_TOKENS);
  expect(haystack).not.toContain(OPEN_RESPONSE_TEXT);
  expect(haystack).not.toContain(fixture.teacher_principal_id);
  expect(haystack).not.toContain(fixture.parent_principal_id);
  expect(haystack).not.toContain(fixture.content_id);
  expect(haystack).not.toContain(fixture.version_id);
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

test.describe("[AIEOS360-S04-I03-E2E] integrated cross-role journey", () => {
  test.beforeAll(() => {
    fixture = loadAieos360S04I03Fixture();
    runPersistenceAssert("assert-coherent-provider-defaults", {
      "tenant-id": fixture.tenant_id,
    });
  });

  test("Phase B — Teacher Publish + Assign uses coherent School Context", async ({
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
    expect(durable.content_id).toBe(f.content_id);
    expect(durable.content_version_id).toBe(f.version_id);
    expect(durable.lifecycle_state).toBe("ACTIVE");
    expect(durable.teacher_principal_id).toBe(DEV_TEACHER_PRINCIPAL_ID);
    expect(durable.source_work_id).toBe(f.work_id);

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
    state.attemptId = page.url().split("/").pop() ?? null;
    expect(state.attemptId).toBeTruthy();

    await page
      .locator(".sos-question")
      .filter({ hasText: /Q-CORRECT/i })
      .getByRole("radio", { name: "1/2" })
      .check();
    await page
      .locator(".sos-question")
      .filter({ hasText: /Q-INCORRECT/i })
      .getByRole("radio", { name: "True" })
      .check();
    await page
      .locator(".sos-question")
      .filter({ hasText: /Q-OPEN/i })
      .locator("textarea")
      .fill(OPEN_RESPONSE_TEXT);
    await page
      .locator(".sos-question")
      .filter({ hasText: /Q-FILLER-A/i })
      .getByRole("radio", { name: "1/4" })
      .check();
    await page
      .locator(".sos-question")
      .filter({ hasText: /Q-FILLER-B/i })
      .getByRole("radio", { name: "True" })
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
      saved.responses.find((item) => item.question_id === f.q_correct_id)
        ?.choice_value,
    ).toBe("1/2");
    expect(
      saved.responses.find((item) => item.question_id === f.q_incorrect_id)
        ?.boolean_value,
    ).toBe(true);
    expect(
      saved.responses.find((item) => item.question_id === f.q_unanswered_id),
    ).toBeFalsy();
    expect(
      saved.responses.find((item) => item.question_id === f.q_open_id)
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
    const objectives = evaluation.objective_results as Record<string, string>;
    expect(objectives[f.obj_demonstrated_id]).toBe(
      "DEMONSTRATED_ON_SUBMITTED_ITEMS",
    );
    expect(objectives[f.obj_not_yet_id]).toBe(
      "NOT_YET_DEMONSTRATED_ON_SUBMITTED_ITEMS",
    );
    expect(objectives[f.obj_insufficient_id]).toBe("INSUFFICIENT_EVIDENCE");
    await expect(
      page.getByRole("button", { name: /Record class assessment/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Improve this class/i }),
    ).toHaveCount(0);

    state.preReadSnapshot = snapshotPersistence(f.tenant_id);
    expect(state.preReadSnapshot.learner_assessment_evaluation_count).toBe(1);
    expect(state.preReadSnapshot.classroom_assessment_count).toBe(0);
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
    await expect(page.getByText("In-scope classes: 2")).toBeVisible();
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
    expect(assignment.title).toBe(fixture.worksheet_title);
    assertParentPrivacy(JSON.stringify(homeBody));
    expect(JSON.stringify(homeBody)).not.toContain(
      fixture.student_b_principal_id,
    );

    await expect(
      page.getByRole("heading", { name: "Parent home" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: fixture.worksheet_title }),
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
      .getByRole("link", { name: /View current facts for Child 1/i })
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
