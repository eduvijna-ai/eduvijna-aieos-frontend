import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { WorksheetHintAuthorPage } from "./WorksheetHintAuthorPage";
import { worksheetPayload } from "@/features/teacher-os/artifacts/artifactFixtures";
import {
  CONTENT_ID,
  DEV_SESSION,
  connectDevSession,
  mockJsonResponse,
  renderWithProviders,
  VERSION_ID,
} from "@/test/test-utils";
import { devSessionConnector } from "@/services/session/DevSessionConnector";
const AUTHOR_ROUTE = `/teacher-os/library/${CONTENT_ID}/learner-hints`;

const libraryDetail = {
  content_id: CONTENT_ID,
  content_type: "worksheet",
  title: "Fractions Worksheet",
  stewardship_state: "APPROVED",
  current_version_id: VERSION_ID,
  published_version_id: VERSION_ID,
  teaching_work_id: null,
  review_navigation: null,
};

const authoringWorksheetPayload = {
  ...worksheetPayload,
  questions: Array.from({ length: 6 }, (_, index) => ({
    ...worksheetPayload.questions[0],
    id: `q-${index + 1}`,
    prompt: `Prompt for question ${index + 1}`,
    answer: `${index + 1}`,
  })),
};

const libraryVersion = {
  content_id: CONTENT_ID,
  version_id: VERSION_ID,
  version_number: 1,
  schema_id: "education.worksheet",
  schema_version: 1,
  payload: authoringWorksheetPayload,
};

function stubAuthoringFlow(
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response> | Response,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (fetchImpl) {
        const custom = await fetchImpl(url, init);
        if (custom) return custom;
      }
      if (url.includes(`/teacher-os/library/${CONTENT_ID}`) && !url.includes("/versions/")) {
        return mockJsonResponse(libraryDetail);
      }
      if (url.includes(`/library/${CONTENT_ID}/versions/${VERSION_ID}`)) {
        return mockJsonResponse(libraryVersion);
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            current_version_id: VERSION_ID,
            stewardship_state: "APPROVED",
          },
          { etag: '"r4"' },
        );
      }
      if (url.includes("/school-context/classes")) {
        return mockJsonResponse({
          items: [{ class_ref: "class-ref-5b", display_label: "Grade 5B" }],
        });
      }
      if (url.includes("/worksheet-learner-hint-versions") && init?.method === "POST") {
        const headers = new Headers(init.headers);
        expect(headers.get("If-Match")).toBe('"r4"');
        expect(headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/i);
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            version_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            version_number: 2,
          },
          { etag: '"r5"', status: 201 },
        );
      }
      return mockJsonResponse({ title: "Not Found", status: 404 }, { status: 404 });
    }),
  );
}

describe("WorksheetHintAuthorPage", () => {
  it("posts guarded append with class_ref and does not auto submit for review", async () => {
    stubAuthoringFlow();
    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );

    await screen.findByTestId("hint-editor");
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.type(
      document.getElementById("hint-q-1") as HTMLTextAreaElement,
      "Think about equal parts.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.some((call) =>
          String(call[0]).includes("/worksheet-learner-hint-versions"),
        ),
      ).toBe(true);
    });
    expect(
      vi.mocked(fetch).mock.calls.some((call) =>
        String(call[0]).includes("/actions/submit-for-review"),
      ),
    ).toBe(false);
  });

  it("preserves unsaved hint drafts after a 412 precondition_failed append", async () => {
    const draftText = "My unsaved teacher hint.";
    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        return mockJsonResponse(
          { title: "Precondition failed", status: 412, detail: {} },
          { status: 412 },
        );
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    const textarea = document.getElementById("hint-q-1") as HTMLTextAreaElement;
    await userEvent.type(textarea, draftText);
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/reconcile/i);
    });
    expect(textarea.value).toBe(draftText);
  });

  it("blocks append after 412 until explicit reconciliation when q-1 prompt changes", async () => {
    const draftText = "Fractions hint from version 1.";
  const alteredPayload = {
      ...authoringWorksheetPayload,
      questions: authoringWorksheetPayload.questions.map((question, index) =>
        index === 0
          ? { ...question, prompt: "Different fraction question on version 2." }
          : question,
      ),
    };
    let servedAltered = false;

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        servedAltered = true;
        return mockJsonResponse(
          { title: "Precondition failed", status: 412, detail: {} },
          { status: 412 },
        );
      }
      if (url.includes(`/library/${CONTENT_ID}/versions/`) && servedAltered) {
        return mockJsonResponse({
          ...libraryVersion,
          payload: alteredPayload,
        });
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    const textarea = document.getElementById("hint-q-1") as HTMLTextAreaElement;
    await userEvent.type(textarea, draftText);
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("unassigned-hint-drafts")).toBeInTheDocument();
    });
    expect(textarea.value).toBe("");
    expect(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: /I reviewed the updated questions/i }),
    );
    await userEvent.type(textarea, draftText);
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    expect(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    ).toBeEnabled();
  });

  it("does not apply a delayed append success after session swap", async () => {
    let resolveAppend!: (value: Response) => void;
    const appendPromise = new Promise<Response>((resolve) => {
      resolveAppend = resolve;
    });

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        return appendPromise;
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.type(
      document.getElementById("hint-q-1") as HTMLTextAreaElement,
      "Think about equal parts.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    devSessionConnector?.connect({
      ...DEV_SESSION,
      bearerToken: "session-b-token",
    });

    resolveAppend(
      mockJsonResponse(
        {
          content_id: CONTENT_ID,
          version_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          version_number: 2,
        },
        { etag: '"r5"', status: 201 },
      ),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Submit for independent review/i }),
      ).toBeDisabled();
    });
    expect(screen.queryByText(/Created hint-bearing worksheet version/i)).toBeNull();
  });

  it("lets a new session start actions after a prior session left in-flight refs set", async () => {
    let resolveAppend!: (value: Response) => void;
    const appendPromise = new Promise<Response>((resolve) => {
      resolveAppend = resolve;
    });

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        return appendPromise;
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.type(
      document.getElementById("hint-q-1") as HTMLTextAreaElement,
      "Think about equal parts.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    devSessionConnector?.connect({
      ...DEV_SESSION,
      bearerToken: "session-b-token",
    });
    await screen.findByTestId("hint-editor");
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.type(
      document.getElementById("hint-q-1") as HTMLTextAreaElement,
      "Fresh hint for session B.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    const createButton = screen.getByRole("button", {
      name: /Create hint-bearing version/i,
    });
    expect(createButton).not.toBeDisabled();

    resolveAppend(
      mockJsonResponse(
        {
          content_id: CONTENT_ID,
          version_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          version_number: 2,
        },
        { etag: '"r5"', status: 201 },
      ),
    );
    await waitFor(() => {
      expect(screen.queryByText(/Created hint-bearing worksheet version/i)).toBeNull();
    });
  });

  it("blocks create after 412 when authoritative content has no current version", async () => {
    const draftText = "Draft with missing current version.";
    let contentCalls = 0;

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        return mockJsonResponse(
          { title: "Precondition failed", status: 412, detail: {} },
          { status: 412 },
        );
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        contentCalls += 1;
        if (contentCalls >= 2) {
          return mockJsonResponse({
            content_id: CONTENT_ID,
            current_version_id: null,
            stewardship_state: "APPROVED",
          });
        }
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    const textarea = document.getElementById("hint-q-1") as HTMLTextAreaElement;
    await userEvent.type(textarea, draftText);
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Create hint-bearing version/i }),
      ).toBeDisabled();
    });
    expect(textarea.value).toBe(draftText);
    expect(
      screen.queryByRole("button", { name: /I reviewed the updated questions/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("reload-authoritative-worksheet"),
    ).toBeInTheDocument();
    const appendPosts = vi.mocked(fetch).mock.calls.filter(
      (call) =>
        String(call[0]).includes("/worksheet-learner-hint-versions") &&
        call[1]?.method === "POST",
    );
    expect(appendPosts.length).toBe(1);
    await userEvent.click(
      screen.getByRole("button", { name: /Preview new version/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    expect(
      vi.mocked(fetch).mock.calls.filter(
        (call) =>
          String(call[0]).includes("/worksheet-learner-hint-versions") &&
          call[1]?.method === "POST",
      ).length,
    ).toBe(1);
  });

  it("requires reconciliation when same version id gains a new Content ETag", async () => {
    const draftText = "Hint for etag-only revision.";
    let contentGets = 0;

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        return mockJsonResponse(
          { title: "Precondition failed", status: 412, detail: {} },
          { status: 412 },
        );
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        contentGets += 1;
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            current_version_id: VERSION_ID,
            stewardship_state: "APPROVED",
          },
          { etag: contentGets >= 2 ? '"r4-new"' : '"r4"' },
        );
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    const textarea = document.getElementById("hint-q-1") as HTMLTextAreaElement;
    await userEvent.type(textarea, draftText);
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    expect(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    ).toBeEnabled();

    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Create hint-bearing version/i }),
      ).toBeDisabled();
    });
    expect(textarea.value).toBe(draftText);
  });

  it("blocks create when V1 to distinct V2 changes q-1 prompt and answer", async () => {
    const VERSION_V2 = "22222222-2222-2222-2222-222222222222";
    const draftText = "Hint authored on version 1.";
    let phase: "initial" | "after412" = "initial";

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        phase = "after412";
        return mockJsonResponse(
          { title: "Precondition failed", status: 412, detail: {} },
          { status: 412 },
        );
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            current_version_id: phase === "initial" ? VERSION_ID : VERSION_V2,
            stewardship_state: "APPROVED",
          },
          { etag: phase === "initial" ? '"r4"' : '"r6"' },
        );
      }
      if (url.includes(`/library/${CONTENT_ID}/versions/`)) {
        const versionMatch = url.match(/\/versions\/([^/?]+)/);
        const requestedVersion = versionMatch?.[1];
        if (requestedVersion === VERSION_V2) {
          return mockJsonResponse({
            ...libraryVersion,
            version_id: VERSION_V2,
            version_number: 2,
            payload: {
              ...authoringWorksheetPayload,
              questions: authoringWorksheetPayload.questions.map(
                (question, index) =>
                  index === 0
                    ? {
                        ...question,
                        prompt: "Completely different fraction wording.",
                        answer: "99",
                      }
                    : question,
              ),
            },
          });
        }
        if (requestedVersion === VERSION_ID) {
          return mockJsonResponse(libraryVersion);
        }
        return mockJsonResponse({ title: "Not Found", status: 404 }, { status: 404 });
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    const textarea = document.getElementById("hint-q-1") as HTMLTextAreaElement;
    await userEvent.type(textarea, draftText);
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Create hint-bearing version/i }),
      ).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent(/worksheet source changed/i);
      expect(screen.getByText(new RegExp(VERSION_V2))).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /I reviewed the updated questions/i }),
    ).toBeInTheDocument();
  });

  it("enters AUTHORITY_UNAVAILABLE on 403 content re-read after 412 with no teacher override", async () => {
    const draftText = "Hint blocked by 403 authority.";
    let contentGets = 0;

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        return mockJsonResponse(
          { title: "Precondition failed", status: 412, detail: {} },
          { status: 412 },
        );
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        contentGets += 1;
        if (contentGets >= 2) {
          return mockJsonResponse(
            { title: "Forbidden", status: 403 },
            { status: 403 },
          );
        }
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    const textarea = document.getElementById("hint-q-1") as HTMLTextAreaElement;
    await userEvent.type(textarea, draftText);
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("reload-authoritative-worksheet")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /I reviewed the updated questions/i }),
    ).not.toBeInTheDocument();
    expect(textarea).toBeDisabled();
    expect(textarea.value).toBe(draftText);
  });

  it("blocks preview and second POST after append transport failure with unchanged version", async () => {
    const draftText = "Uncertain append hint.";
    const capturedKeys: string[] = [];

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        const headers = new Headers(init.headers);
        const key = headers.get("Idempotency-Key");
        if (key) capturedKeys.push(key);
        return mockJsonResponse(
          { title: "Gateway error", status: 503, detail: {} },
          { status: 503 },
        );
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            current_version_id: VERSION_ID,
            stewardship_state: "APPROVED",
          },
          { etag: '"r4"' },
        );
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.type(
      document.getElementById("hint-q-1") as HTMLTextAreaElement,
      draftText,
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("reload-authoritative-worksheet")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Preview new version/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    ).toBeDisabled();
    expect(capturedKeys).toHaveLength(1);
    expect(
      document.querySelector("[data-author-phase='APPEND_OUTCOME_UNCERTAIN']"),
    ).toBeInTheDocument();
  });

  it("preserves idempotency key for same material after uncertain append until resolution", async () => {
    const keys: string[] = [];
    let appendAttempts = 0;

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        appendAttempts += 1;
        const headers = new Headers(init.headers);
        const key = headers.get("Idempotency-Key");
        if (key) keys.push(key);
        if (appendAttempts === 1) {
          return mockJsonResponse(
            { title: "Service unavailable", status: 503 },
            { status: 503 },
          );
        }
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            version_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            version_number: 2,
          },
          { etag: '"r5"', status: 201 },
        );
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.type(
      document.getElementById("hint-q-1") as HTMLTextAreaElement,
      "Stable material hint.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("reload-authoritative-worksheet")).toBeInTheDocument();
    });
    expect(appendAttempts).toBe(1);

    await userEvent.click(screen.getByTestId("reload-authoritative-worksheet"));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /I reviewed the updated questions/i }),
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /I reviewed the updated questions/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    await waitFor(() => {
      expect(appendAttempts).toBe(2);
    });
    expect(keys[0]).toBeDefined();
    expect(keys[1]).toBe(keys[0]);
  });

  it("explicit submit-for-review after successful create uses separate idempotency", async () => {
    const submitKeys: string[] = [];
    stubAuthoringFlow((url, init) => {
      if (url.includes("/actions/submit-for-review") && init?.method === "POST") {
        const headers = new Headers(init.headers);
        const key = headers.get("Idempotency-Key");
        if (key) submitKeys.push(key);
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            version_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            stewardship_state: "IN_REVIEW",
          },
          { etag: '"r6"', status: 201 },
        );
      }
      return undefined as unknown as Response;
    });

    connectDevSession(DEV_SESSION);
    renderWithProviders(
      <Routes>
        <Route
          path="/teacher-os/library/:contentId/learner-hints"
          element={<WorksheetHintAuthorPage />}
        />
      </Routes>,
      { route: AUTHOR_ROUTE },
    );
    await screen.findByTestId("hint-editor");
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.type(
      document.getElementById("hint-q-1") as HTMLTextAreaElement,
      "Think about equal parts.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Submit for independent review/i }),
      ).toBeEnabled();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Submit for independent review/i }),
    );
    await waitFor(() => {
      expect(submitKeys).toHaveLength(1);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/Submitted for independent review/i);
  });
});