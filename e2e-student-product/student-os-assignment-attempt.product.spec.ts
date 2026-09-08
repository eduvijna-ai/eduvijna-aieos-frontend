import { expect, test } from "@playwright/test";
import {
  assertNoApiMocksInstalled,
  assertOpaqueCursor,
  connectStudentDevSession,
  denyCurrentMembership,
  loadStudentProductFixture,
  studentApiHeaders,
} from "./support/studentProductHarness";

test.describe("[AIEOS360-S01-I04R1:student-product-e2e] Student real-stack journey", () => {
  test("Home → assignments → start → save TRUE_FALSE → resume → submit → historical", async ({
    page,
  }) => {
    assertNoApiMocksInstalled(page);
    const fixture = loadStudentProductFixture();

    await page.goto("/student-os/home");
    await connectStudentDevSession(page);

    // O. Student Home real HTTP (list/home omit resource; title comes from detail GET)
    await expect(page.getByRole("heading", { name: "Your work" })).toBeVisible();
    await expect(
      page.getByText(/You have\s+6\s+current assignments/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /See all 6 assignments/i }),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/student-os/assignments/${fixture.assignment_id}"]`),
    ).toBeVisible();

    const homeResponse = await page.request.get("/api/v1/student-os/home", {
      headers: studentApiHeaders(),
    });
    expect(homeResponse.ok()).toBeTruthy();
    const homeBody = (await homeResponse.json()) as {
      current_assignment_count: number;
      items: Array<{ assignment_id: string; resource: unknown }>;
    };
    expect(homeBody.current_assignment_count).toBe(6);
    expect(homeBody.items.length).toBe(5);
    expect(
      homeBody.items.some((item) => item.assignment_id === fixture.assignment_id),
    ).toBeTruthy();
    expect(homeBody.items.every((item) => item.resource == null)).toBeTruthy();

    // P. Assignment list + opaque next_cursor (limit=1)
    const listPage1 = await page.request.get(
      "/api/v1/student-os/assignments?limit=1",
      { headers: studentApiHeaders() },
    );
    expect(listPage1.ok()).toBeTruthy();
    const listBody1 = (await listPage1.json()) as {
      items: Array<{ assignment_id: string; content_version_id: string }>;
      next_cursor: string | null;
    };
    expect(listBody1.items).toHaveLength(1);
    assertOpaqueCursor(listBody1.next_cursor);

    const listPage2 = await page.request.get(
      `/api/v1/student-os/assignments?limit=1&cursor=${encodeURIComponent(listBody1.next_cursor!)}`,
      { headers: studentApiHeaders() },
    );
    expect(listPage2.ok()).toBeTruthy();
    const listBody2 = (await listPage2.json()) as {
      items: Array<{ assignment_id: string }>;
      next_cursor: string | null;
    };
    expect(listBody2.items).toHaveLength(1);
    expect(listBody2.items[0]!.assignment_id).not.toBe(
      listBody1.items[0]!.assignment_id,
    );

    await page.getByRole("link", { name: "Assignments", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Assignments", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/student-os/assignments/${fixture.assignment_id}"]`),
    ).toBeVisible();

    // Q. Assignment detail + exact ContentVersion (resource present on GET detail)
    await page
      .locator(`a[href="/student-os/assignments/${fixture.assignment_id}"]`)
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: fixture.worksheet_title }),
    ).toBeVisible();
    await expect(page.getByText(/Assigned version/i)).toBeVisible();
    await expect(page.getByText(/exact version assigned/i)).toBeVisible();

    const detailResponse = await page.request.get(
      `/api/v1/student-os/assignments/${fixture.assignment_id}`,
      { headers: studentApiHeaders() },
    );
    expect(detailResponse.ok()).toBeTruthy();
    const detail = (await detailResponse.json()) as {
      assignment_id: string;
      content_version_id: string;
      resource: { title: string; content_version_id?: string };
    };
    expect(detail.assignment_id).toBe(fixture.assignment_id);
    expect(detail.content_version_id).toBe(fixture.content_version_id);
    expect(detail.resource.title).toBe(fixture.worksheet_title);
    expect(detail.resource.content_version_id ?? detail.content_version_id).toBe(
      fixture.content_version_id,
    );

    // R. START
    await page.getByRole("button", { name: /Start this work/i }).click();
    await expect(page).toHaveURL(/\/student-os\/attempts\//);
    await expect(page.getByText(/In progress/i)).toBeVisible();

    const attemptUrl = page.url();
    const attemptId = attemptUrl.split("/").pop()!;

    // S / T. SAVE TRUE_FALSE as JSON boolean
    const trueFalsePrompt = page
      .locator(".sos-question")
      .filter({ hasText: /True or false/i })
      .first();
    await trueFalsePrompt.getByRole("radio", { name: "True" }).check();
    await page.getByRole("button", { name: /Save answers/i }).click();
    await expect(page.getByText(/Answers saved/i)).toBeVisible();

    const savedAttempt = await page.request.get(
      `/api/v1/learning/attempts/${attemptId}`,
      { headers: studentApiHeaders() },
    );
    expect(savedAttempt.ok()).toBeTruthy();
    const savedBody = (await savedAttempt.json()) as {
      lifecycle_state: string;
      responses: Array<{
        question_id: string;
        response_kind: string;
        boolean_value: boolean | null;
      }>;
    };
    expect(savedBody.lifecycle_state).toBe("IN_PROGRESS");
    const tf = savedBody.responses.find(
      (r) => r.question_id === fixture.true_false_question_id,
    );
    expect(tf).toBeTruthy();
    expect(tf!.response_kind).toBe("TRUE_FALSE");
    expect(tf!.boolean_value).toBe(true);
    expect(typeof tf!.boolean_value).toBe("boolean");

    // U. RESUME via reload / GET attempt
    await page.reload();
    await connectStudentDevSession(page);
    await expect(page.getByRole("radio", { name: "True" }).first()).toBeChecked();
    await expect(page.getByRole("button", { name: /Save answers/i })).toBeVisible();

    // V. SUBMIT
    await page.getByRole("button", { name: /Submit work/i }).click();
    await expect(
      page.getByRole("dialog", { name: /Submit this work/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Yes, submit/i }).click();
    await expect(page.getByText(/Work submitted/i)).toBeVisible();
    await expect(page.getByText(/This work is submitted/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Save answers/i })).toHaveCount(
      0,
    );

    // W. Submitted reload is read-only
    await page.reload();
    await connectStudentDevSession(page);
    await expect(page.getByText(/This work is submitted/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Save answers/i })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: /Submit work/i })).toHaveCount(
      0,
    );

    const submittedAttempt = await page.request.get(
      `/api/v1/learning/attempts/${attemptId}`,
      { headers: studentApiHeaders() },
    );
    expect(submittedAttempt.ok()).toBeTruthy();
    const submittedBody = (await submittedAttempt.json()) as {
      lifecycle_state: string;
    };
    expect(submittedBody.lifecycle_state).toBe("SUBMITTED");

    // X. Historical submitted visibility after current membership denied
    denyCurrentMembership(fixture);
    const homeAfterDeny = await page.request.get("/api/v1/student-os/home", {
      headers: studentApiHeaders(),
    });
    expect(homeAfterDeny.ok()).toBeTruthy();
    const homeDenied = (await homeAfterDeny.json()) as {
      current_assignment_count: number;
    };
    expect(homeDenied.current_assignment_count).toBe(0);

    const assignmentAfterDeny = await page.request.get(
      `/api/v1/student-os/assignments/${fixture.assignment_id}`,
      { headers: studentApiHeaders() },
    );
    expect(assignmentAfterDeny.status()).toBeGreaterThanOrEqual(400);

    await page.reload();
    await connectStudentDevSession(page);
    await expect(page.getByText(/This work is submitted/i)).toBeVisible();
    await expect(
      page.getByText(/submitted answers are shown below/i),
    ).toBeVisible();
    await expect(page.getByLabel("Submitted answers")).toContainText(/True/i);

    assertNoApiMocksInstalled(page);
  });
});
