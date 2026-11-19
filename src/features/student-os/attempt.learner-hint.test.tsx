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

const HINTS_URL = `/api/v1/learning/attempts/${ATTEMPT_ID}/learner-hints`;

function inProgressAttemptPageStub(
  extra?: (call: { url: string; method: string }) => Response | undefined,
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