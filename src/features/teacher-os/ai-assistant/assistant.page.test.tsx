import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  mockJsonResponse,
  mockProblemResponse,
  renderApp,
  stubFetch,
} from "@/test/test-utils";

const ASSISTANT_PATH = "/api/v1/teacher-os/assistant";
const FOCUS_QUESTION = "What should I focus on today?";
const SAMPLE_ANSWER =
  "Based on today's mission context, prioritize the highest-urgency teacher action.";

function sampleAssistantResponse(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    answer: SAMPLE_ANSWER,
    suggested_questions: [
      "Summarize the current teaching work.",
      "What preparation is already available?",
    ],
    suggested_next_step:
      "Open Today's Mission and confirm the hero action yourself.",
    teaching_work_id: null,
    context_summary: "Mission-scoped context (read-only).",
    generated_at: "2026-09-06T12:00:00Z",
    ...overrides,
  };
}

function isAssistantPost(call: { url: string; method: string }): boolean {
  return call.method === "POST" && call.url.includes(ASSISTANT_PATH);
}

describe("AiAssistantPage", () => {
  it("replaces PlaceholderPage and renders AI Assistant heading", async () => {
    stubFetch(() => mockJsonResponse(sampleAssistantResponse()));
    renderApp("/teacher-os/ai-assistant");
    expect(
      await screen.findByRole("heading", { name: /^AI Assistant$/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Not implemented yet/i)).not.toBeInTheDocument();
  });

  it("submits a message and renders the assistant response", async () => {
    const user = userEvent.setup();
    const calls = stubFetch((call) => {
      if (isAssistantPost(call)) {
        return mockJsonResponse(sampleAssistantResponse());
      }
      return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/ai-assistant");
    await screen.findByRole("heading", { name: /^AI Assistant$/ });

    await user.type(screen.getByLabelText(/^Message$/i), FOCUS_QUESTION);
    await user.click(screen.getByRole("button", { name: /^Send$/i }));

    expect(await screen.findByText(SAMPLE_ANSWER)).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();

    const post = calls.find(isAssistantPost);
    expect(post).toBeTruthy();
    expect(post?.url).toBe(ASSISTANT_PATH);
    expect(post?.body).toEqual({
      message: FOCUS_QUESTION,
      history: [],
      teaching_work_id: null,
      mission_date: null,
    });
  });

  it("lets suggested prompts resubmit via the same Backend path", async () => {
    const user = userEvent.setup();
    const calls = stubFetch((call) => {
      if (isAssistantPost(call)) {
        return mockJsonResponse(sampleAssistantResponse());
      }
      return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/ai-assistant");
    await user.type(screen.getByLabelText(/^Message$/i), FOCUS_QUESTION);
    await user.click(screen.getByRole("button", { name: /^Send$/i }));
    expect(await screen.findByText(SAMPLE_ANSWER)).toBeInTheDocument();

    const suggestion = screen.getByRole("button", {
      name: "Summarize the current teaching work.",
    });
    await user.click(suggestion);

    await waitFor(() => {
      expect(calls.filter(isAssistantPost)).toHaveLength(2);
    });
    expect(calls[1]?.body).toMatchObject({
      message: "Summarize the current teaching work.",
    });
    expect(
      screen.getAllByText("Summarize the current teaching work.").length,
    ).toBeGreaterThan(0);
  });

  it("keeps chat history session-only (no localStorage/sessionStorage writes)", async () => {
    const user = userEvent.setup();
    const localSet = vi.spyOn(window.localStorage, "setItem");
    const sessionSet = vi.spyOn(window.sessionStorage, "setItem");
    stubFetch((call) => {
      if (isAssistantPost(call)) {
        return mockJsonResponse(sampleAssistantResponse());
      }
      return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/ai-assistant");
    await user.type(screen.getByLabelText(/^Message$/i), FOCUS_QUESTION);
    await user.click(screen.getByRole("button", { name: /^Send$/i }));
    expect(await screen.findByText(SAMPLE_ANSWER)).toBeInTheDocument();

    expect(localSet).not.toHaveBeenCalled();
    expect(sessionSet).not.toHaveBeenCalled();
  });

  it("clears conversation with New conversation and Clear conversation", async () => {
    const user = userEvent.setup();
    stubFetch((call) => {
      if (isAssistantPost(call)) {
        return mockJsonResponse(sampleAssistantResponse());
      }
      return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/ai-assistant");
    await user.type(screen.getByLabelText(/^Message$/i), FOCUS_QUESTION);
    await user.click(screen.getByRole("button", { name: /^Send$/i }));
    expect(await screen.findByText(SAMPLE_ANSWER)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /New conversation/i }));
    expect(screen.queryByText(SAMPLE_ANSWER)).not.toBeInTheDocument();
    expect(screen.getByText(/Ask a teaching question/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Message$/i), FOCUS_QUESTION);
    await user.click(screen.getByRole("button", { name: /^Send$/i }));
    expect(await screen.findByText(SAMPLE_ANSWER)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Clear conversation/i }),
    );
    expect(screen.queryByText(SAMPLE_ANSWER)).not.toBeInTheDocument();
    expect(screen.getByText(/Ask a teaching question/i)).toBeInTheDocument();
  });

  it("shows a loading state while the Backend responds", async () => {
    const user = userEvent.setup();
    let resolveResponse: ((value: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    stubFetch((call) => {
      if (isAssistantPost(call)) {
        return pending;
      }
      return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/ai-assistant");
    await user.type(screen.getByLabelText(/^Message$/i), FOCUS_QUESTION);
    await user.click(screen.getByRole("button", { name: /^Send$/i }));

    expect(await screen.findByText(/Thinking/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send$/i })).toBeDisabled();

    resolveResponse?.(mockJsonResponse(sampleAssistantResponse()));
    expect(await screen.findByText(SAMPLE_ANSWER)).toBeInTheDocument();
    expect(screen.queryByText(/Thinking/i)).not.toBeInTheDocument();
  });

  it("surfaces provider/API failures without clearing the user turn", async () => {
    const user = userEvent.setup();
    stubFetch((call) => {
      if (isAssistantPost(call)) {
        return mockProblemResponse(503, "model_provider_unavailable", "Unavailable");
      }
      return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/ai-assistant");
    await user.type(screen.getByLabelText(/^Message$/i), FOCUS_QUESTION);
    await user.click(screen.getByRole("button", { name: /^Send$/i }));

    expect(
      await screen.findByText(/Assistant request failed/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The service is temporarily unavailable/i),
    ).toBeInTheDocument();
    expect(screen.getByText(FOCUS_QUESTION)).toBeInTheDocument();
  });

  it("calls only the Backend assistant path (no provider SDK traffic)", async () => {
    const user = userEvent.setup();
    const calls = stubFetch((call) => {
      if (isAssistantPost(call)) {
        return mockJsonResponse(sampleAssistantResponse());
      }
      return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
    });

    renderApp("/teacher-os/ai-assistant");
    await user.type(screen.getByLabelText(/^Message$/i), FOCUS_QUESTION);
    await user.click(screen.getByRole("button", { name: /^Send$/i }));
    expect(await screen.findByText(SAMPLE_ANSWER)).toBeInTheDocument();

    expect(calls.every((call) => call.url === ASSISTANT_PATH)).toBe(true);
    expect(calls.every((call) => call.method === "POST")).toBe(true);
    expect(
      calls.some((call) => /openai|anthropic|generativelanguage/i.test(call.url)),
    ).toBe(false);
  });

  it("keeps suggested actions as navigation links only (no silent mutate POSTs)", async () => {
    const user = userEvent.setup();
    const calls = stubFetch((call) => {
      if (isAssistantPost(call)) {
        return mockJsonResponse(sampleAssistantResponse());
      }
      if (call.url.includes("/api/v1/teacher-os/mission")) {
        return mockJsonResponse({
          mission_date: "2026-09-06",
          review: { pending_count: 0 },
          preparation: { active_work_count: 0, continue_work: null },
          hero_action: { kind: "prepare_tomorrow", work_id: null },
        });
      }
      return mockJsonResponse({ title: "ok", status: 200 });
    });

    renderApp("/teacher-os/ai-assistant");
    await user.type(screen.getByLabelText(/^Message$/i), FOCUS_QUESTION);
    await user.click(screen.getByRole("button", { name: /^Send$/i }));
    expect(await screen.findByText(SAMPLE_ANSWER)).toBeInTheDocument();

    const postsBeforeNav = calls.filter((call) => call.method === "POST").length;

    const guardrail = screen.getByText(/Suggested actions never mutate/i);
    for (const name of ["Today", "Prepare", "Teach", "Assess", "Improve"]) {
      expect(
        within(guardrail).getByRole("link", { name }),
      ).toBeInTheDocument();
    }

    await user.click(within(guardrail).getByRole("link", { name: "Prepare" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Help me prepare tomorrow/i }),
      ).toBeInTheDocument();
    });

    const postsAfterNav = calls.filter((call) => call.method === "POST");
    expect(postsAfterNav).toHaveLength(postsBeforeNav);
    expect(
      postsAfterNav.every((call) => call.url.includes(ASSISTANT_PATH)),
    ).toBe(true);
    expect(
      postsAfterNav.some((call) =>
        /publish|assign|memory|from-classroom-assessment|executions/i.test(
          call.url,
        ),
      ),
    ).toBe(false);
  });
});
