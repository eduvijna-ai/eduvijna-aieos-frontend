import { expect, test, type Request, type Response } from "@playwright/test";
import {
  DEV_TEACHER_PRINCIPAL_ID,
  FORBIDDEN_PARENT_TOKENS,
  PARENT_FRONTEND_URL,
  PARENT_OS_HOME_PATH,
  STUDENT_FRONTEND_URL,
  TEACHER_FRONTEND_URL,
  artifactPath,
  assertNoApiMocksInstalled,
  assertParentTransportOnly,
  connectParentDevSession,
  connectStudentDevSession,
  connectTeacherDevSession,
  describeApiRequest,
  fetchTeachingAssignment,
  isApiRequest,
  loadAieos360S03I04Fixture,
  openParentPage,
  openStudentPage,
  openTeacherPage,
  parentChildUrl,
  parentHomeUrl,
  parentOsChildPath,
  runPersistenceAssert,
  snapshotPersistence,
  studentApiHeaders,
  type PersistenceSnapshot,
} from "./support/aieos360S03I04Harness";

/**
 * AIEOS360-S03-I04 — Parent OS real-stack Parent Intelligence journey.
 * Zero Playwright API mocks. Shared PostgreSQL. Three identity surfaces.
 */

test.describe.configure({ mode: "serial" });

const OPEN_RESPONSE_TEXT =
  "Because both show the same amount of the whole.";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const state: {
  assignmentId: string | null;
  attemptId: string | null;
  submissionId: string | null;
  preParentSnapshot: PersistenceSnapshot | null;
  postParentSnapshot: PersistenceSnapshot | null;
  homeBody: Record<string, unknown> | null;
  childBody: Record<string, unknown> | null;
  generatedAt: string | null;
} = {
  assignmentId: null,
  attemptId: null,
  submissionId: null,
  preParentSnapshot: null,
  postParentSnapshot: null,
  homeBody: null,
  childBody: null,
  generatedAt: null,
};

let fixture: ReturnType<typeof loadAieos360S03I04Fixture>;

function asRecord(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  expect(Array.isArray(value)).toBe(true);
  return value as unknown[];
}

function assertForbiddenTokensAbsent(haystack: string) {
  const lower = haystack.toLowerCase();
  for (const token of FORBIDDEN_PARENT_TOKENS) {
    expect(lower).not.toContain(token.toLowerCase());
  }
  expect(haystack).not.toContain(OPEN_RESPONSE_TEXT);
  expect(haystack).not.toContain(fixture.teacher_principal_id);
  expect(haystack).not.toContain(fixture.parent_principal_id);
  expect(haystack).not.toContain(fixture.content_id);
  expect(haystack).not.toContain(fixture.version_id);
  if (state.attemptId) {
    expect(haystack).not.toContain(state.attemptId);
  }
  if (state.submissionId) {
    expect(haystack).not.toContain(state.submissionId);
  }
}

function parentApiGets(responses: Response[], pathname: string) {
  return responses.filter((response) => {
    try {
      const parsed = new URL(response.url());
      return (
        parsed.pathname === pathname && response.request().method() === "GET"
      );
    } catch {
      return false;
    }
  });
}

test.describe("[AIEOS360-S03-I04-E2E] Parent OS real-stack journey", () => {
  test.beforeAll(() => {
    fixture = loadAieos360S03I04Fixture();
    runPersistenceAssert("assert-canonical-parent-access-unchanged", {
      "tenant-id": fixture.tenant_id,
    });
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
      { headers: { "X-AIEOS-Tenant-ID": f.tenant_id, Authorization: `Bearer ${f.teacher_bearer_token}` } },
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

    await page.context().close();
  });

  test("Phase B — Student A START / SAVE / SUBMIT creates durable Learning facts", async ({
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

  test("Phase C — Parent Home, Child GET, Refresh, concealment, and read-only proof", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const f = fixture;
    expect(state.assignmentId).toBeTruthy();
    expect(state.submissionId).toBeTruthy();

    state.preParentSnapshot = snapshotPersistence(f.tenant_id);
    expect(state.preParentSnapshot.teaching_assignment_count).toBe(1);
    expect(state.preParentSnapshot.learner_attempt_count).toBe(1);
    expect(state.preParentSnapshot.learner_submission_count).toBe(1);
    expect(state.preParentSnapshot.alembic_head).toBe("a360s010004");
    expect(state.preParentSnapshot.parent_persistence_tables).toEqual([]);

    const page = await openParentPage(browser);
    assertNoApiMocksInstalled(page);

    const apiRequests: Request[] = [];
    const apiResponses: Response[] = [];
    page.on("request", (request) => {
      if (isApiRequest(request)) apiRequests.push(request);
    });
    page.on("response", (response) => {
      if (isApiRequest(response.request())) apiResponses.push(response);
    });

    const homeResponsePromise = page.waitForResponse(
      (response) => {
        const parsed = parentHomeUrl(response.url());
        return parsed !== null && response.request().method() === "GET";
      },
      { timeout: 30_000 },
    );

    await page.goto(`${PARENT_FRONTEND_URL}/parent-os`);
    await connectParentDevSession(page);
    const homeResponse = await homeResponsePromise;
    expect(homeResponse.request().method()).toBe("GET");
    const homeUrl = parentHomeUrl(homeResponse.url());
    expect(homeUrl).not.toBeNull();
    expect(homeUrl!.pathname).toBe(PARENT_OS_HOME_PATH);
    expect(homeUrl!.search).toBe("");
    assertParentTransportOnly(homeResponse.request(), f);
    expect(homeResponse.status()).toBe(200);

    const homeBody = (await homeResponse.json()) as Record<string, unknown>;
    state.homeBody = homeBody;
    state.generatedAt = String(homeBody.generated_at);
    expect(Number.isNaN(Date.parse(state.generatedAt))).toBe(false);
    expect(homeBody.projection_mode).toBe("DERIVED_ON_REQUEST");
    const timeWindow = asRecord(homeBody.time_window);
    expect(timeWindow.mode).toBe("CURRENT_FACTS_AS_OF_REQUEST");

    const children = asArray(homeBody.children);
    expect(children).toHaveLength(1);
    const child = asRecord(children[0]);
    expect(child.learner_principal_id).toBe(f.student_principal_id);
    expect(child.learner_principal_id).not.toBe(f.student_b_principal_id);
    const assignments = asArray(child.assignments);
    expect(assignments).toHaveLength(1);
    const assignment = asRecord(assignments[0]);
    expect(assignment.assignment_id).toBe(state.assignmentId);
    expect(assignment.title).toBe(f.worksheet_title);
    expect(assignment.content_type).toBe("worksheet");
    expect(assignment.attempt_status).toBe("SUBMITTED");
    expect(assignment.submitted_at).toBeTruthy();
    expect(assignment.due_at).toBeNull();
    expect(Object.keys(assignment).sort()).toEqual(
      [
        "assignment_id",
        "attempt_status",
        "available_from",
        "content_type",
        "due_at",
        "submitted_at",
        "title",
      ].sort(),
    );
    assertForbiddenTokensAbsent(JSON.stringify(homeBody));
    expect(JSON.stringify(homeBody)).not.toContain(f.student_b_principal_id);

    await expect(
      page.getByRole("heading", { name: "Parent home" }),
    ).toBeVisible();
    await expect(page.getByText("Current facts as of this request")).toBeVisible();
    await expect(
      page.getByTestId("parent-child-card-0").getByRole("heading", {
        name: "Child 1",
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: f.worksheet_title })).toBeVisible();
    await expect(page.getByText("worksheet", { exact: true })).toBeVisible();
    await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
    await expect(page.getByText("No due date")).toBeVisible();
    await expect(page.locator(".parent-os-basis")).toContainText(/today at /i);
    expect((await page.locator("body").innerText()).match(/today at /gi)?.length).toBeGreaterThanOrEqual(2);

    const homeVisible = await page.locator("body").innerText();
    expect(homeVisible).not.toContain(f.student_principal_id);
    expect(homeVisible).not.toContain(f.student_b_principal_id);
    expect(homeVisible.toLowerCase()).not.toContain("student a");
    expect(homeVisible.toLowerCase()).not.toContain("student b");
    assertForbiddenTokensAbsent(homeVisible);

    const homeGetsBeforeChild = parentApiGets(
      apiResponses,
      PARENT_OS_HOME_PATH,
    );
    expect(homeGetsBeforeChild).toHaveLength(1);

    const childPath = parentOsChildPath(f.student_principal_id);
    const childResponsePromise = page.waitForResponse((response) => {
      const parsed = parentChildUrl(response.url(), f.student_principal_id);
      return (
        parsed !== null &&
        response.request().method() === "GET" &&
        response.status() === 200
      );
    });
    await page
      .getByRole("link", { name: /View current facts for Child 1/i })
      .click();
    const childResponse = await childResponsePromise;
    expect(childResponse.request().method()).toBe("GET");
    const childUrl = parentChildUrl(
      childResponse.url(),
      f.student_principal_id,
    );
    expect(childUrl).not.toBeNull();
    expect(childUrl!.pathname).toBe(childPath);
    expect(childUrl!.search).toBe("");
    assertParentTransportOnly(childResponse.request(), f);
    expect(childResponse.status()).toBe(200);

    const childBody = (await childResponse.json()) as Record<string, unknown>;
    state.childBody = childBody;
    expect(childBody.projection_mode).toBe("DERIVED_ON_REQUEST");
    const childChildren = asArray(childBody.children);
    expect(childChildren).toHaveLength(1);
    expect(asRecord(childChildren[0]).learner_principal_id).toBe(
      f.student_principal_id,
    );
    const childAssignments = asArray(asRecord(childChildren[0]).assignments);
    expect(asRecord(childAssignments[0]).attempt_status).toBe("SUBMITTED");
    expect(asRecord(childAssignments[0]).assignment_id).toBe(state.assignmentId);
    assertForbiddenTokensAbsent(JSON.stringify(childBody));

    await expect(
      page.getByRole("heading", { name: "Child facts" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: f.worksheet_title })).toBeVisible();
    await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
    const childVisible = await page.locator("body").innerText();
    expect(childVisible).not.toContain(f.student_principal_id);
    assertForbiddenTokensAbsent(childVisible);

    expect(parentApiGets(apiResponses, PARENT_OS_HOME_PATH)).toHaveLength(1);
    const childGetsAfterDetail = parentApiGets(apiResponses, childPath);
    expect(childGetsAfterDetail.length).toBeGreaterThanOrEqual(1);
    expect(
      childGetsAfterDetail.every((response) => response.status() === 200),
    ).toBe(true);

    const childGetsBeforeRefresh = parentApiGets(apiResponses, childPath).length;
    const refreshResponsePromise = page.waitForResponse((response) => {
      const parsed = parentChildUrl(response.url(), f.student_principal_id);
      return (
        parsed !== null &&
        response.request().method() === "GET" &&
        response.status() === 200
      );
    });
    await page.getByRole("button", { name: "Refresh" }).click();
    const refreshResponse = await refreshResponsePromise;
    expect(refreshResponse.request().method()).toBe("GET");
    expect(refreshResponse.request().postData()).toBeNull();
    assertParentTransportOnly(refreshResponse.request(), f);
    expect(parentApiGets(apiResponses, childPath)).toHaveLength(
      childGetsBeforeRefresh + 1,
    );
    expect(
      apiRequests.every((request) => !MUTATION_METHODS.has(request.method())),
    ).toBe(true);

    await page.waitForTimeout(1500);
    expect(parentApiGets(apiResponses, childPath)).toHaveLength(
      childGetsBeforeRefresh + 1,
    );
    expect(parentApiGets(apiResponses, PARENT_OS_HOME_PATH)).toHaveLength(1);

    const unauthorizedPath = parentOsChildPath(f.student_b_principal_id);
    const unauthorizedCountBefore = parentApiGets(
      apiResponses,
      unauthorizedPath,
    ).length;
    await page.goto(
      `${PARENT_FRONTEND_URL}/parent-os/children/${f.student_b_principal_id}`,
    );
    const unauthorizedPromise = page.waitForResponse((response) => {
      const parsed = parentChildUrl(
        response.url(),
        f.student_b_principal_id,
      );
      return parsed !== null && response.request().method() === "GET";
    });
    await connectParentDevSession(page);
    const unauthorizedResponse = await unauthorizedPromise;
    expect(unauthorizedResponse.status()).toBe(404);
    expect(unauthorizedResponse.request().method()).toBe("GET");
    assertParentTransportOnly(unauthorizedResponse.request(), f);
    const unauthorizedBody = (await unauthorizedResponse.text()).toLowerCase();
    expect(unauthorizedBody).not.toContain("unauthorized");
    expect(unauthorizedBody).not.toContain("forbidden learner");
    expect(unauthorizedBody).not.toContain("student b");
    expect(unauthorizedBody).not.toContain("other parent");
    expect(unauthorizedBody).not.toContain("wrong family");
    expect(unauthorizedBody).not.toContain("revoked");

    await expect(
      page.getByRole("heading", { name: "This child is not available." }),
    ).toBeVisible();
    const concealmentVisible = await page.locator("body").innerText();
    expect(concealmentVisible).toContain("This child is not available.");
    expect(concealmentVisible.toLowerCase()).not.toContain("unauthorized");
    expect(concealmentVisible.toLowerCase()).not.toContain("forbidden learner");
    expect(concealmentVisible.toLowerCase()).not.toContain("student b");
    expect(concealmentVisible.toLowerCase()).not.toContain("other parent");
    expect(concealmentVisible.toLowerCase()).not.toContain("wrong family");
    expect(concealmentVisible.toLowerCase()).not.toContain("other class");
    expect(concealmentVisible.toLowerCase()).not.toContain("other tenant");
    expect(concealmentVisible.toLowerCase()).not.toContain("learner exists");
    expect(concealmentVisible.toLowerCase()).not.toContain("revoked");
    expect(concealmentVisible).not.toContain(f.student_b_principal_id);
    expect(concealmentVisible).not.toContain(f.student_principal_id);
    assertForbiddenTokensAbsent(concealmentVisible);

    await page.waitForTimeout(1500);
    expect(parentApiGets(apiResponses, unauthorizedPath)).toHaveLength(
      unauthorizedCountBefore + 1,
    );
    expect(
      apiRequests.every((request) => !MUTATION_METHODS.has(request.method())),
    ).toBe(true);
    expect(
      apiRequests.some((request) => request.url().includes("/nats")),
    ).toBe(false);
    expect(
      apiRequests.some((request) =>
        request.url().toLowerCase().includes("temporal"),
      ),
    ).toBe(false);
    expect(apiRequests.map(describeApiRequest).join("\n")).not.toMatch(
      /\b(POST|PUT|PATCH|DELETE)\b/,
    );

    runPersistenceAssert("assert-no-parent-tables", {
      "tenant-id": f.tenant_id,
    });
    state.postParentSnapshot = snapshotPersistence(f.tenant_id);
    expect(state.postParentSnapshot).toEqual(state.preParentSnapshot);

    await page.context().close();
  });
});
