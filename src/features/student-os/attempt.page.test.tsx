import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  mockJsonResponse,
  mockProblemResponse,
  renderApp,
  stubFetch,
} from "@/test/test-utils";
import {
  ASSIGNMENT_ID,
  ATTEMPT_ID,
  CONTENT_VERSION_ID,
  sampleAssignment,
  sampleAttempt,
} from "./studentOs.fixtures";

describe("Student assignment detail", () => {
  it("renders the exact assigned content version and does not fetch a later publication", async () => {
    const calls = stubFetch((call) => {
      if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
        return mockJsonResponse(sampleAssignment());
      }
      return mockProblemResponse(404, "not_found");
    });

    renderApp(`/student-os/assignments/${ASSIGNMENT_ID}`);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Leaf parts worksheet" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/exact version assigned/i)).toBeInTheDocument();
    expect(screen.getByText("Name one part of a leaf.")).toBeInTheDocument();
    expect(
      calls.every(
        (call) =>
          !call.url.includes("/api/v1/contents/") &&
          !call.url.includes("/api/v1/teacher-os/library/"),
      ),
    ).toBe(true);
    expect(sampleAssignment().content_version_id).toBe(CONTENT_VERSION_ID);
  });

  it("starts an attempt with a stable Idempotency-Key and retries the same key", async () => {
    const calls = stubFetch((call) => {
      if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
        return mockJsonResponse(sampleAssignment());
      }
      if (call.method === "POST" && call.url.includes("/attempts")) {
        if (calls.filter((item) => item.method === "POST").length === 1) {
          throw new TypeError("Failed to fetch");
        }
        return mockJsonResponse(sampleAttempt(), {
          status: 201,
          etag: '"r0"',
        });
      }
      if (call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}`) {
        return mockJsonResponse(sampleAttempt(), { etag: '"r0"' });
      }
      return mockProblemResponse(404, "not_found");
    });

    renderApp(`/student-os/assignments/${ASSIGNMENT_ID}`);
    await screen.findByRole("heading", { level: 1, name: "Leaf parts worksheet" });
    await userEvent.click(screen.getByRole("button", { name: /Start this work/i }));
    expect(
      await screen.findByText(/Could not reach the server/i),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Start this work/i }));
    await waitFor(() => {
      expect(calls.filter((call) => call.method === "POST")).toHaveLength(2);
    });
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0]?.headers.get("Idempotency-Key")).toBeTruthy();
    expect(posts[0]?.headers.get("Idempotency-Key")).toBe(
      posts[1]?.headers.get("Idempotency-Key"),
    );
    expect(posts[0]?.url).toBe(
      `/api/v1/learning/assignments/${ASSIGNMENT_ID}/attempts`,
    );
  });

  it("explains cancelled or unavailable assignments", async () => {
    stubFetch(() =>
      mockProblemResponse(
        409,
        "assignment_closed_or_cancelled",
        "assignment_closed_or_cancelled",
      ),
    );
    renderApp(`/student-os/assignments/${ASSIGNMENT_ID}`);
    expect(
      await screen.findByText(/closed or cancelled/i),
    ).toBeInTheDocument();
  });

  it("treats membership concealment as unavailable, not success", async () => {
    stubFetch(() =>
      mockProblemResponse(404, "assignment_not_found", "assignment_not_found"),
    );
    renderApp(`/student-os/assignments/${ASSIGNMENT_ID}`);
    expect(
      await screen.findByText(/This assignment is not available/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start this work/i })).not.toBeInTheDocument();
  });
});

describe("Student attempt experience", () => {
  it("resumes saved answers from backend truth", async () => {
    stubFetch((call) => {
      if (call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}`) {
        return mockJsonResponse(
          sampleAttempt({
            aggregate_revision: 1,
            last_saved_at: "2026-09-08T10:05:00Z",
            responses: [
              {
                question_id: "q-tf",
                response_kind: "TRUE_FALSE",
                boolean_value: true,
                choice_value: null,
                text_value: null,
              },
            ],
          }),
          { etag: '"r1"' },
        );
      }
      if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
        return mockJsonResponse(
          sampleAssignment({
            attempt_summary: "IN_PROGRESS",
            attempt_id: ATTEMPT_ID,
          }),
        );
      }
      return mockProblemResponse(404, "not_found");
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    const trueRadio = await screen.findByRole("radio", { name: "True" });
    expect(trueRadio).toBeChecked();
    expect(screen.getByRole("radio", { name: "False" })).not.toBeChecked();
  });

  it("saves TRUE_FALSE answers as JSON booleans", async () => {
    let saved = sampleAttempt();
    const calls = stubFetch((call) => {
      if (call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}`) {
        return mockJsonResponse(saved, { etag: `"r${saved.aggregate_revision}"` });
      }
      if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
        return mockJsonResponse(
          sampleAssignment({
            attempt_summary: "IN_PROGRESS",
            attempt_id: ATTEMPT_ID,
          }),
        );
      }
      if (call.url.endsWith("/responses") && call.method === "PUT") {
        saved = sampleAttempt({
          aggregate_revision: 1,
          last_saved_at: "2026-09-08T10:05:00Z",
          responses: [
            {
              question_id: "q-tf",
              response_kind: "TRUE_FALSE",
              boolean_value: true,
              choice_value: null,
              text_value: null,
            },
          ],
        });
        return mockJsonResponse(saved, { etag: '"r1"' });
      }
      return mockProblemResponse(404, "not_found");
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    await userEvent.click(screen.getByRole("radio", { name: "True" }));
    await userEvent.click(screen.getByRole("button", { name: /Save answers/i }));
    expect(await screen.findByText("Answers saved.")).toBeInTheDocument();
    const save = calls.find((call) => call.method === "PUT");
    const body = save?.body as {
      responses: Array<{ boolean_value?: unknown; response_kind: string }>;
    };
    const tf = body.responses.find((item) => item.response_kind === "TRUE_FALSE");
    expect(tf?.boolean_value).toBe(true);
    expect(typeof tf?.boolean_value).toBe("boolean");
    expect(JSON.stringify(tf?.boolean_value)).toBe("true");
    expect(save?.headers.get("If-Match")).toBe('"r0"');
    expect(save?.headers.get("Idempotency-Key")).toBeTruthy();
  });

  it("requires confirmation before submit and then becomes read-only", async () => {
    let current = sampleAttempt({ aggregate_revision: 1 });
    stubFetch((call) => {
      if (call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}`) {
        return mockJsonResponse(current, { etag: '"r1"' });
      }
      if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
        return mockJsonResponse(
          sampleAssignment({
            attempt_summary: current.lifecycle_state,
            attempt_id: ATTEMPT_ID,
          }),
        );
      }
      if (call.url.endsWith("/actions/submit")) {
        current = sampleAttempt({
          lifecycle_state: "SUBMITTED",
          submitted_at: "2026-09-08T11:00:00Z",
          submission_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          aggregate_revision: 2,
        });
        return mockJsonResponse(current, { etag: '"r2"' });
      }
      return mockProblemResponse(404, "not_found");
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByRole("button", { name: /Submit work/i });
    await userEvent.click(screen.getByRole("button", { name: /Submit work/i }));
    expect(
      screen.getByRole("dialog", { name: /Submit this work/i }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Yes, submit/i }));
    expect(await screen.findByText(/This work is submitted/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save answers/i })).not.toBeInTheDocument();
  });

  it("keeps submitted historical answers when current assignment load is denied", async () => {
    stubFetch((call) => {
      if (call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}`) {
        return mockJsonResponse(
          sampleAttempt({
            lifecycle_state: "SUBMITTED",
            submitted_at: "2026-09-08T11:00:00Z",
            submission_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            responses: [
              {
                question_id: "q-tf",
                response_kind: "TRUE_FALSE",
                boolean_value: false,
                choice_value: null,
                text_value: null,
              },
            ],
          }),
          { etag: '"r2"' },
        );
      }
      return mockProblemResponse(404, "assignment_not_found");
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    expect(await screen.findByText("False")).toBeInTheDocument();
    expect(
      screen.getByText(/submitted work remains/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save answers/i })).not.toBeInTheDocument();
  });
});
