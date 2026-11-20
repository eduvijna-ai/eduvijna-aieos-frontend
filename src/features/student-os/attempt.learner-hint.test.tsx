import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  connectDevSession,
  DEV_SESSION,
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

const HINTS_URL = `/api/v1/learning/attempts/${ATTEMPT_ID}/learner-hints`;

function inProgressAttemptPageStub(
  extra?: (
    call: { url: string; method: string },
  ) => Response | Promise<Response> | undefined,
) {
  return stubFetch((call) => {
    if (call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}`) {
      return mockJsonResponse(sampleAttempt(), { etag: '"r0"' });
    }
    if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
      return mockJsonResponse(
        sampleAssignment({
          attempt_summary: "IN_PROGRESS",
          attempt_id: ATTEMPT_ID,
        }),
      );
    }
    const custom = extra?.(call);
    if (custom) {
      return custom;
    }
    return mockProblemResponse(404, "not_found");
  });
}

describe("Student attempt learner hints (PK-V1-HINT-F)", () => {
  it("does not request learner hints on mount", async () => {
    const calls = inProgressAttemptPageStub();
    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    expect(calls.some((call) => call.url === HINTS_URL)).toBe(false);
  });

  it("requests one attempt-scoped GET with cache no-store after Show hint", async () => {
    const calls = inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL && call.method === "GET") {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "Think about leaf veins." }],
        });
      }
      return undefined;
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    const showHintButtons = screen.getAllByRole("button", {
      name: /Show hint for question/i,
    });
    await userEvent.click(showHintButtons[0]!);

    await waitFor(() => {
      expect(
        screen.getByText("Think about leaf veins."),
      ).toBeInTheDocument();
    });
    const hintGets = calls.filter(
      (call) => call.url === HINTS_URL && call.method === "GET",
    );
    expect(hintGets).toHaveLength(1);
    expect(hintGets[0]?.cache).toBe("no-store");
    expect(screen.queryByText("Leaves make food.")).not.toBeInTheDocument();
  });

  it("shows empty copy when hints list omits the question", async () => {
    inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL) {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [],
        });
      }
      return undefined;
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    await userEvent.click(
      screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
    );
    expect(
      await screen.findByText(/No hint available for this question/i),
    ).toBeInTheDocument();
  });

  it("does not render foreign hint text when attempt binding mismatches", async () => {
    inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL) {
        return mockJsonResponse({
          attempt_id: "00000000-0000-4000-8000-000000000099",
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "Foreign hint." }],
        });
      }
      return undefined;
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    await userEvent.click(
      screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
    );
    expect(
      await screen.findByText(/could not load a hint/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Foreign hint.")).not.toBeInTheDocument();
  });

  it("ignores a hint GET that completes after submit started", async () => {
    let resolveHint: (() => void) | undefined;
    const hintPromise = new Promise<Response>((resolve) => {
      resolveHint = () =>
        resolve(
          mockJsonResponse({
            attempt_id: ATTEMPT_ID,
            content_version_id: CONTENT_VERSION_ID,
            hints: [{ question_id: "q-tf", hint_text: "Late hint." }],
          }),
        );
    });

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
      if (call.url === HINTS_URL) {
        return hintPromise;
      }
      if (call.url.endsWith("/actions/submit")) {
        current = sampleAttempt({
          lifecycle_state: "SUBMITTED",
          submitted_at: "2026-09-08T11:00:00Z",
          submission_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          aggregate_revision: 2,
        });
        resolveHint?.();
        return mockJsonResponse(current, { etag: '"r2"' });
      }
      return mockProblemResponse(404, "not_found");
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByRole("button", { name: /Submit work/i });
    await userEvent.click(
      screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
    );
    await userEvent.click(screen.getByRole("button", { name: /Submit work/i }));
    await userEvent.click(screen.getByRole("button", { name: /Yes, submit/i }));
    await screen.findByText(/does not show a grade or score/i);
    expect(screen.queryByText("Late hint.")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show hint for question/i }),
    ).not.toBeInTheDocument();
  });

  it("re-issues GET on repeated Show hint clicks", async () => {
    const calls = inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL && call.method === "GET") {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "Fresh hint." }],
        });
      }
      return undefined;
    });
    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    const show = screen.getAllByRole("button", { name: /Show hint for question/i })[0]!;
    await userEvent.click(show);
    await screen.findByText("Fresh hint.");
    await userEvent.click(show);
    await waitFor(() => {
      expect(
        calls.filter((call) => call.url === HINTS_URL && call.method === "GET"),
      ).toHaveLength(2);
    });
  });

  it.each([
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [422, "invalid"],
    [500, "internal"],
  ] as const)(
    "shows safe error without retaining hints after HTTP %i",
    async (status, code) => {
      inProgressAttemptPageStub((call) => {
        if (call.url === HINTS_URL) {
          return mockProblemResponse(status, code);
        }
        return undefined;
      });
      renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
      await screen.findByText("A leaf has veins.");
      await userEvent.click(
        screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
      );
      expect(
        await screen.findByText(/could not load a hint/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/about:blank/i)).not.toBeInTheDocument();
    },
  );

  it("purges a prior hint when a later GET is denied", async () => {
    let deny = false;
    inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL) {
        if (deny) {
          return mockProblemResponse(403, "forbidden");
        }
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "First hint." }],
        });
      }
      return undefined;
    });
    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    const show = screen.getAllByRole("button", { name: /Show hint for question/i })[0]!;
    await userEvent.click(show);
    await screen.findByText("First hint.");
    deny = true;
    await userEvent.click(show);
    expect(await screen.findByText(/could not load a hint/i)).toBeInTheDocument();
    expect(screen.queryByText("First hint.")).not.toBeInTheDocument();
  });

  it("fails closed on malformed hint payload", async () => {
    inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL) {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: { bad: true } }],
        });
      }
      return undefined;
    });
    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    await userEvent.click(
      screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
    );
    expect(await screen.findByText(/could not load a hint/i)).toBeInTheDocument();
  });

  it("clears revealed hint when dev session swaps without unmount", async () => {
    inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL) {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "Student A private hint." }],
        });
      }
      return undefined;
    });
    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    await userEvent.click(
      screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
    );
    await screen.findByText("Student A private hint.");

    connectDevSession({
      ...DEV_SESSION,
      bearerToken: "student-b-session-token",
    });

    await waitFor(() => {
      expect(screen.queryByText("Student A private hint.")).not.toBeInTheDocument();
    });
  });

  it("clears hints when dev session disconnects", async () => {
    inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL) {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "Disconnect hint." }],
        });
      }
      return undefined;
    });
    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    await userEvent.click(
      screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
    );
    await screen.findByText("Disconnect hint.");
    const { devSessionConnector } = await import(
      "@/services/session/DevSessionConnector"
    );
    devSessionConnector?.disconnect();
    await waitFor(() => {
      expect(screen.queryByText("Disconnect hint.")).not.toBeInTheDocument();
    });
  });

  it("does not start a hint GET while save is in flight", async () => {
    let resolveSave: (() => void) | undefined;
    const saveWait = new Promise<Response>((resolve) => {
      resolveSave = () =>
        resolve(
          mockJsonResponse(sampleAttempt({ aggregate_revision: 2 }), {
            etag: '"r2"',
          }),
        );
    });

    const calls = inProgressAttemptPageStub((call) => {
      if (call.url.includes("/responses") && call.method === "PUT") {
        return saveWait;
      }
      if (call.url === HINTS_URL) {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "Should not load." }],
        });
      }
      return undefined;
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    await userEvent.click(
      screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
    );
    await screen.findByText("Should not load.");
    void userEvent.click(screen.getByRole("button", { name: /Save answers/i }));
    const show = screen.getAllByRole("button", { name: /Show hint for question/i })[0]!;
    await userEvent.click(show);
    expect(
      calls.filter((call) => call.url === HINTS_URL && call.method === "GET"),
    ).toHaveLength(1);
    resolveSave?.();
    await waitFor(() => {
      expect(screen.queryByText("Should not load.")).not.toBeInTheDocument();
    });
  });

  it("clears revealed hint on fingerprint-collision session pair (session incarnation)", async () => {
    const collisionA = {
      ...DEV_SESSION,
      bearerToken: "test-session-0000v",
    };
    const collisionB = {
      ...DEV_SESSION,
      bearerToken: "test-session-00060",
    };

    inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL) {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "Collision-session hint." }],
        });
      }
      return undefined;
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`, collisionA);
    await screen.findByText("A leaf has veins.");
    await userEvent.click(
      screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
    );
    await screen.findByText("Collision-session hint.");

    connectDevSession(collisionB);

    await waitFor(() => {
      expect(screen.queryByText("Collision-session hint.")).not.toBeInTheDocument();
    });
    expect(collisionA.bearerToken).not.toBe(collisionB.bearerToken);
  });

  it("clears hint when reconnecting the same bearer (new session object)", async () => {
    inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL) {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "Incarnation hint." }],
        });
      }
      return undefined;
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    await userEvent.click(
      screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
    );
    await screen.findByText("Incarnation hint.");
    connectDevSession({ ...DEV_SESSION });
    await waitFor(() => {
      expect(screen.queryByText("Incarnation hint.")).not.toBeInTheDocument();
    });
  });

  it("does not apply a late attempt GET from the prior session after swap", async () => {
    let resolveFirstAttempt: ((response: Response) => void) | undefined;
    const firstAttemptPending = new Promise<Response>((resolve) => {
      resolveFirstAttempt = resolve;
    });
    let attemptGets = 0;

    stubFetch((call) => {
      if (
        call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}` &&
        call.method === "GET"
      ) {
        attemptGets += 1;
        if (attemptGets === 1) {
          return firstAttemptPending;
        }
        return mockProblemResponse(404, "not_found");
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

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`, {
      ...DEV_SESSION,
      bearerToken: "test-session-0000v",
    });
    connectDevSession({
      ...DEV_SESSION,
      bearerToken: "test-session-00060",
    });

    resolveFirstAttempt?.(
      mockJsonResponse(
        sampleAttempt({
          lifecycle_state: "SUBMITTED",
          submitted_at: "2026-09-08T11:00:00Z",
          submission_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          responses: [
            {
              question_id: "q-tf",
              response_kind: "TRUE_FALSE",
              boolean_value: true,
              text_value: null,
              choice_value: null,
            },
          ],
        }),
        { etag: '"r9"' },
      ),
    );

    expect(
      await screen.findByText(/Could not open this work/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Your submitted answers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Submitted work/i)).not.toBeInTheDocument();
  });

  it("ignores a late assignment GET after session swap", async () => {
    let resolveAssignment: ((response: Response) => void) | undefined;
    const assignmentPending = new Promise<Response>((resolve) => {
      resolveAssignment = resolve;
    });
    let assignmentGets = 0;

    stubFetch((call) => {
      if (call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}`) {
        return mockJsonResponse(sampleAttempt(), { etag: '"r0"' });
      }
      if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
        assignmentGets += 1;
        if (assignmentGets === 1) {
          return assignmentPending;
        }
        return mockProblemResponse(404, "not_found");
      }
      return mockProblemResponse(404, "not_found");
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText(/Loading your work/i);
    connectDevSession({
      ...DEV_SESSION,
      bearerToken: "other-learner-token",
    });

    resolveAssignment?.(mockJsonResponse(sampleAssignment()));

    expect(
      await screen.findByText(/Could not open this work/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("A leaf has veins.")).not.toBeInTheDocument();
  });

  it("keeps hints disabled when submit POST fails but server already submitted", async () => {
    let current = sampleAttempt({ aggregate_revision: 1 });

    stubFetch((call) => {
      if (call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}`) {
        if (call.method === "GET") {
          return mockJsonResponse(current, {
            etag: `"r${current.aggregate_revision}"`,
          });
        }
      }
      if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
        return mockJsonResponse(
          sampleAssignment({
            attempt_summary: current.lifecycle_state,
            attempt_id: ATTEMPT_ID,
          }),
        );
      }
      if (call.url.endsWith("/actions/submit") && call.method === "POST") {
        current = sampleAttempt({
          lifecycle_state: "SUBMITTED",
          submitted_at: "2026-09-08T11:00:00Z",
          submission_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          aggregate_revision: 2,
        });
        throw new TypeError("network reset");
      }
      return mockProblemResponse(404, "not_found");
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByRole("button", { name: /Submit work/i });
    await userEvent.click(screen.getByRole("button", { name: /Submit work/i }));
    await userEvent.click(screen.getByRole("button", { name: /Yes, submit/i }));

    await screen.findByText(/does not show a grade or score/i);
    expect(
      screen.queryByRole("button", { name: /Show hint for question/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps hints disabled when submit network error and re-read fails", async () => {
    let submitAttempted = false;
    stubFetch((call) => {
      if (call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}`) {
        if (submitAttempted) {
          return mockProblemResponse(500, "internal");
        }
        return mockJsonResponse(sampleAttempt(), { etag: '"r1"' });
      }
      if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
        return mockJsonResponse(
          sampleAssignment({
            attempt_summary: "IN_PROGRESS",
            attempt_id: ATTEMPT_ID,
          }),
        );
      }
      if (call.url.endsWith("/actions/submit")) {
        submitAttempted = true;
        throw new TypeError("network reset");
      }
      if (call.url === HINTS_URL) {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "Should stay hidden." }],
        });
      }
      return mockProblemResponse(404, "not_found");
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    const show = await screen.findAllByRole("button", {
      name: /Show hint for question/i,
    });
    await screen.findByRole("button", { name: /Submit work/i });
    await userEvent.click(screen.getByRole("button", { name: /Submit work/i }));
    await userEvent.click(screen.getByRole("button", { name: /Yes, submit/i }));
    expect(
      await screen.findByRole("alert"),
    ).toBeInTheDocument();
    await userEvent.click(show[0]!);
    expect(screen.queryByText("Should stay hidden.")).not.toBeInTheDocument();
  });

  it("does not start a hint GET in the same submit flight", async () => {
    let resolveSubmit: (() => void) | undefined;
    const submitPending = new Promise<Response>((resolve) => {
      resolveSubmit = () =>
        resolve(
          mockJsonResponse(
            sampleAttempt({
              lifecycle_state: "SUBMITTED",
              submitted_at: "2026-09-08T11:00:00Z",
              submission_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            }),
            { etag: '"r2"' },
          ),
        );
    });

    const calls = inProgressAttemptPageStub((call) => {
      if (call.url.endsWith("/actions/submit") && call.method === "POST") {
        return submitPending;
      }
      if (call.url === HINTS_URL) {
        return mockJsonResponse({
          attempt_id: ATTEMPT_ID,
          content_version_id: CONTENT_VERSION_ID,
          hints: [{ question_id: "q-tf", hint_text: "Mid-submit hint." }],
        });
      }
      return undefined;
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    await userEvent.click(screen.getByRole("button", { name: /Submit work/i }));
    await userEvent.click(screen.getByRole("button", { name: /Yes, submit/i }));
    const show = screen.getAllByRole("button", { name: /Show hint for question/i })[0]!;
    await userEvent.click(show);
    expect(
      calls.filter((call) => call.url === HINTS_URL && call.method === "GET"),
    ).toHaveLength(0);
    resolveSubmit?.();
    await screen.findByText(/does not show a grade or score/i);
  });

  it("ignores a pending hint GET that resolves after session swap", async () => {
    let resolveHint: (() => void) | undefined;
    const hintPending = new Promise<Response>((resolve) => {
      resolveHint = () =>
        resolve(
          mockJsonResponse({
            attempt_id: ATTEMPT_ID,
            content_version_id: CONTENT_VERSION_ID,
            hints: [{ question_id: "q-tf", hint_text: "Late after swap." }],
          }),
        );
    });

    inProgressAttemptPageStub((call) => {
      if (call.url === HINTS_URL) {
        return hintPending;
      }
      return undefined;
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText("A leaf has veins.");
    void userEvent.click(
      screen.getAllByRole("button", { name: /Show hint for question/i })[0]!,
    );
    connectDevSession({ ...DEV_SESSION, bearerToken: "swap-mid-hint" });
    resolveHint?.();
    await waitFor(() => {
      expect(screen.queryByText("Late after swap.")).not.toBeInTheDocument();
    });
  });

  it("does not expose hint UI on submitted historical attempts", async () => {
    stubFetch((call) => {
      if (call.url === `/api/v1/learning/attempts/${ATTEMPT_ID}`) {
        return mockJsonResponse(
          sampleAttempt({
            lifecycle_state: "SUBMITTED",
            submitted_at: "2026-09-08T11:00:00Z",
            submission_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          }),
          { etag: '"r2"' },
        );
      }
      return mockProblemResponse(404, "assignment_not_found");
    });

    renderApp(`/student-os/attempts/${ATTEMPT_ID}`);
    await screen.findByText(/submission is still here to read/i);
    expect(
      screen.queryByRole("button", { name: /Show hint for question/i }),
    ).not.toBeInTheDocument();
  });
});