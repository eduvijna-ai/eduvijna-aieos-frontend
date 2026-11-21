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

const CREATED_HINT_VERSION = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function appendVersionResponse(
  versionId: string,
  versionNumber = 2,
): Record<string, unknown> {
  return {
    content_id: CONTENT_ID,
    version_id: versionId,
    version_number: versionNumber,
    schema_id: "education.worksheet",
    schema_version: 2,
    created_at: "2026-11-20T12:00:00Z",
    origin: "test",
    parent_version_id: VERSION_ID,
    payload: {},
    payload_sha256:
      "0000000000000000000000000000000000000000000000000000000000000000",
  };
}

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
  let authoritativeVersionId = VERSION_ID;
  let contentEtag = '"r4"';
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
            current_version_id: authoritativeVersionId,
            stewardship_state: "APPROVED",
          },
          { etag: contentEtag },
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
        authoritativeVersionId = CREATED_HINT_VERSION;
        contentEtag = '"r5"';
        return mockJsonResponse(appendVersionResponse(CREATED_HINT_VERSION), {
          etag: contentEtag,
          status: 201,
        });
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
        appendVersionResponse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
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

  it("lets a new session append after prior session left recover in flight", async () => {
    let resolveRecovery!: (value: Response) => void;
    const recoveryPromise = new Promise<Response>((resolve) => {
      resolveRecovery = resolve;
    });
    const appendPosts: Array<{ key: string | null; body: string }> = [];
    let appendAttempts = 0;

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        appendAttempts += 1;
        const headers = new Headers(init?.headers);
        const body = String(init?.body ?? "");
        appendPosts.push({ key: headers.get("Idempotency-Key"), body });
        if (appendAttempts === 1) {
          return mockJsonResponse(
            { title: "Service unavailable", status: 503 },
            { status: 503 },
          );
        }
        if (appendAttempts === 2) {
          return recoveryPromise;
        }
        return mockJsonResponse(appendVersionResponse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"), {
          etag: '"b-created"',
          status: 201,
        });
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            current_version_id:
              appendAttempts >= 3
                ? "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
                : VERSION_ID,
            stewardship_state: "APPROVED",
          },
          { etag: appendAttempts >= 3 ? '"b-created"' : '"r4"' },
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
      "Session A uncertain hint.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    await waitFor(() => screen.getByTestId("recover-original-append"));
    await userEvent.click(screen.getByTestId("recover-original-append"));

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
      "Session B distinct hint body.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => expect(appendAttempts).toBeGreaterThanOrEqual(3));
    expect(appendPosts).toHaveLength(3);
    expect(appendPosts[1].key).toBe(appendPosts[0].key);
    expect(appendPosts[2].key).not.toBe(appendPosts[0].key);
    expect(appendPosts[2].body).toContain("Session B distinct hint body.");

    resolveRecovery(
      mockJsonResponse(appendVersionResponse(CREATED_HINT_VERSION), {
        etag: '"stale-a"',
        status: 201,
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByText(/Session A uncertain hint/i),
      ).not.toBeInTheDocument();
    });
    expect(appendPosts[2].body).toContain("Session B distinct hint body.");
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

  it("stays uncertain after reload on same V1 until explicit recovery with same key and body", async () => {
    const keys: string[] = [];
    const etags: string[] = [];
    const bodies: string[] = [];
    let appendAttempts = 0;
    const CREATED_V2 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        appendAttempts += 1;
        const headers = new Headers(init.headers);
        const key = headers.get("Idempotency-Key");
        const etag = headers.get("If-Match");
        if (key) keys.push(key);
        if (etag) etags.push(etag);
        if (init.body) bodies.push(String(init.body));
        if (appendAttempts === 1) {
          return mockJsonResponse(
            { title: "Service unavailable", status: 503 },
            { status: 503 },
          );
        }
        return mockJsonResponse(appendVersionResponse(CREATED_V2), {
          etag: '"r5-after-recovery"',
          status: 201,
        });
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            current_version_id: appendAttempts >= 2 ? CREATED_V2 : VERSION_ID,
            stewardship_state: "APPROVED",
          },
          { etag: appendAttempts >= 2 ? '"r5-after-recovery"' : '"r4"' },
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
      expect(screen.getByTestId("recover-original-append")).toBeInTheDocument();
    });
    expect(appendAttempts).toBe(1);
    expect(
      screen.queryByRole("button", { name: /I reviewed the updated questions/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    ).toBeDisabled();

    await userEvent.click(screen.getByTestId("reload-authoritative-worksheet"));
    await waitFor(() => {
      expect(
        document.querySelector("[data-author-phase='APPEND_OUTCOME_UNCERTAIN']"),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /I reviewed the updated questions/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("recover-original-append"));
    await waitFor(() => {
      expect(appendAttempts).toBe(2);
    });
    expect(keys[1]).toBe(keys[0]);
    expect(etags[1]).toBe(etags[0]);
    expect(bodies[1]).toBe(bodies[0]);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Created hint-bearing/i);
    });
  });

  it("does not drop uncertain receipt when reload sees V2 from another writer", async () => {
    const VERSION_V2 = "22222222-2222-2222-2222-222222222222";
    let appendAttempts = 0;

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        appendAttempts += 1;
        return mockJsonResponse(
          { title: "Service unavailable", status: 503 },
          { status: 503 },
        );
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            current_version_id: VERSION_V2,
            stewardship_state: "APPROVED",
          },
          { etag: '"r6"' },
        );
      }
      if (url.includes(`/library/${CONTENT_ID}/versions/${VERSION_V2}`)) {
        return mockJsonResponse({
          ...libraryVersion,
          version_id: VERSION_V2,
          version_number: 2,
          payload: {
            ...authoringWorksheetPayload,
            questions: authoringWorksheetPayload.questions.map((q, i) =>
              i === 0
                ? { ...q, prompt: "Another teacher wrote this version." }
                : q,
            ),
          },
        });
      }
      if (url.includes(`/library/${CONTENT_ID}/versions/${VERSION_ID}`)) {
        return mockJsonResponse(libraryVersion);
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
      "Hint before uncertain.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("recover-original-append")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId("reload-authoritative-worksheet"));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(VERSION_V2);
    });
    expect(
      document.querySelector("[data-author-phase='APPEND_OUTCOME_UNCERTAIN']"),
    ).toBeInTheDocument();
    expect(appendAttempts).toBe(1);
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    expect(appendAttempts).toBe(1);
  });

  it("replays submit recovery with original etag and idempotency key", async () => {
    const CREATED_V2 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const submitKeys: string[] = [];
    const submitEtags: string[] = [];
    let submitAttempts = 0;

    stubAuthoringFlow((url, init) => {
      if (url.includes("/actions/submit-for-review") && init?.method === "POST") {
        submitAttempts += 1;
        const headers = new Headers(init.headers);
        const key = headers.get("Idempotency-Key");
        const etag = headers.get("If-Match");
        if (key) submitKeys.push(key);
        if (etag) submitEtags.push(etag);
        if (submitAttempts === 1) {
          return mockJsonResponse(
            { title: "Service unavailable", status: 503 },
            { status: 503 },
          );
        }
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            version_id: CREATED_V2,
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
      expect(screen.getByTestId("recover-original-submit")).toBeInTheDocument();
    });
    expect(submitAttempts).toBe(1);
    await userEvent.click(screen.getByTestId("recover-original-submit"));
    await waitFor(() => {
      expect(submitAttempts).toBe(2);
    });
    expect(submitKeys[1]).toBe(submitKeys[0]);
    expect(submitEtags[1]).toBe(submitEtags[0]);
    expect(screen.getByRole("status")).toHaveTextContent(/Submitted for independent review/i);
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

  it("disables submit until deferred content GET confirms current version", async () => {
    let resolveContentGet!: (value: Response) => void;
    const contentGetPromise = new Promise<Response>((resolve) => {
      resolveContentGet = resolve;
    });
    let submitPosts = 0;
    let contentGets = 0;

    stubAuthoringFlow((url, init) => {
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        contentGets += 1;
        if (contentGets >= 2) {
          return contentGetPromise;
        }
      }
      if (url.includes("/actions/submit-for-review") && init?.method === "POST") {
        submitPosts += 1;
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            version_id: CREATED_HINT_VERSION,
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
      "Deferred verify hint.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(
        document.querySelector("[data-author-phase='APPEND_CURRENT_VERIFY_REQUIRED']"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Submit for independent review/i }),
    ).toBeDisabled();
    expect(submitPosts).toBe(0);

    resolveContentGet(
      mockJsonResponse(
        {
          content_id: CONTENT_ID,
          current_version_id: CREATED_HINT_VERSION,
          stewardship_state: "APPROVED",
        },
        { etag: '"r5"' },
      ),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Submit for independent review/i }),
      ).toBeEnabled();
    });
    expect(
      document.querySelector("[data-author-phase='READY']"),
    ).toBeInTheDocument();
  });

  it("blocks submit when post-append GET has null current version", async () => {
    let contentGets = 0;
    stubAuthoringFlow((url, init) => {
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        contentGets += 1;
        if (contentGets >= 2) {
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
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.type(
      document.getElementById("hint-q-1") as HTMLTextAreaElement,
      "Hint with null current.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Submit for independent review/i }),
      ).toBeDisabled();
    });
    expect(
      document.querySelector("[data-author-phase='AUTHORITY_UNAVAILABLE']"),
    ).toBeInTheDocument();
    expect(
      vi.mocked(fetch).mock.calls.filter((call) =>
        String(call[0]).includes("/actions/submit-for-review"),
      ),
    ).toHaveLength(0);
  });

  it("reconciles superseded V2 on V3 and creates V4 with fresh idempotency", async () => {
    const V2 = CREATED_HINT_VERSION;
    const V3 = "33333333-3333-3333-3333-333333333333";
    const V4 = "44444444-4444-4444-4444-444444444444";
    let contentGets = 0;
    let submitPosts = 0;
    const appendKeys: string[] = [];

    stubAuthoringFlow((url, init) => {
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        contentGets += 1;
        if (contentGets === 1) {
          return mockJsonResponse(
            {
              content_id: CONTENT_ID,
              current_version_id: VERSION_ID,
              stewardship_state: "APPROVED",
            },
            { etag: '"r4"' },
          );
        }
        if (contentGets === 2) {
          return mockJsonResponse(
            {
              content_id: CONTENT_ID,
              current_version_id: V3,
              stewardship_state: "APPROVED",
            },
            { etag: '"r7"' },
          );
        }
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            current_version_id: V4,
            stewardship_state: "APPROVED",
          },
          { etag: '"r8"' },
        );
      }
      if (url.includes(`/library/${CONTENT_ID}/versions/${V3}`)) {
        return mockJsonResponse({
          ...libraryVersion,
          version_id: V3,
          version_number: 3,
          schema_version: 2,
          payload: {
            ...authoringWorksheetPayload,
            questions: authoringWorksheetPayload.questions.map((q, i) =>
              i === 0
                ? { ...q, prompt: "Superseding question on V3.", answer: "42" }
                : q,
            ),
          },
        });
      }
      if (url.includes("/actions/submit-for-review") && init?.method === "POST") {
        submitPosts += 1;
        const versionInUrl = url.match(/versions\/([^/]+)/)?.[1];
        expect(versionInUrl).toBe(V4);
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            version_id: V4,
            stewardship_state: "IN_REVIEW",
          },
          { etag: '"r9"', status: 201 },
        );
      }
      if (url.includes("/worksheet-learner-hint-versions") && init?.method === "POST") {
        const headers = new Headers(init?.headers);
        const key = headers.get("Idempotency-Key");
        if (key) appendKeys.push(key);
        const ifMatch = headers.get("If-Match");
        if (ifMatch === '"r4"') {
          return mockJsonResponse(appendVersionResponse(V2), {
            etag: '"r5"',
            status: 201,
          });
        }
        expect(ifMatch).toBe('"r7"');
        return mockJsonResponse(appendVersionResponse(V4, 4), {
          etag: '"r8"',
          status: 201,
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
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.type(
      document.getElementById("hint-q-1") as HTMLTextAreaElement,
      "Hint on V2 path.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => {
      expect(
        document.querySelector("[data-author-phase='RECONCILIATION_REQUIRED']"),
      ).toBeInTheDocument();
    });
    expect(appendKeys).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: /I reviewed the updated questions/i }),
    );
    expect(
      screen.getByRole("button", { name: /Submit for independent review/i }),
    ).toBeDisabled();

    const q1 = document.getElementById("hint-q-1") as HTMLTextAreaElement;
    await userEvent.clear(q1);
    await userEvent.type(q1, "Hint aligned to V3 superseding prompt.");
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );

    await waitFor(() => expect(appendKeys).toHaveLength(2));
    expect(appendKeys[1]).not.toBe(appendKeys[0]);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Submit for independent review/i }),
      ).toBeEnabled();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Submit for independent review/i }),
    );
    expect(submitPosts).toBe(1);
  });

  it("preserves append receipt after recovery 412", async () => {
    const keys: string[] = [];
    let appendAttempts = 0;

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        appendAttempts += 1;
        const key = new Headers(init.headers).get("Idempotency-Key");
        if (key) keys.push(key);
        if (appendAttempts === 1) {
          return mockJsonResponse({ title: "unavailable", status: 503 }, { status: 503 });
        }
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
    await userEvent.selectOptions(
      screen.getByLabelText(/Authoring class/i),
      "class-ref-5b",
    );
    await userEvent.type(
      document.getElementById("hint-q-1") as HTMLTextAreaElement,
      "Uncertain then 412.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    await waitFor(() => screen.getByTestId("recover-original-append"));
    await userEvent.click(screen.getByTestId("recover-original-append"));
    await waitFor(() => expect(appendAttempts).toBe(2));
    expect(keys[0]).toBe(keys[1]);
    expect(
      document.querySelector("[data-author-phase='APPEND_OUTCOME_UNCERTAIN']"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    ).toBeDisabled();
    expect(appendAttempts).toBe(2);
  });

  it("rejects delayed recovery status after session swap", async () => {
    let resolveRecovery!: (value: Response) => void;
    const recoveryPromise = new Promise<Response>((resolve) => {
      resolveRecovery = resolve;
    });
    let appendAttempts = 0;

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        appendAttempts += 1;
        if (appendAttempts === 1) {
          return mockJsonResponse({ title: "unavailable", status: 503 }, { status: 503 });
        }
        return recoveryPromise;
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
      "Session A hint private.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    await waitFor(() => screen.getByTestId("recover-original-append"));
    await userEvent.click(screen.getByTestId("recover-original-append"));

    devSessionConnector?.connect({
      ...DEV_SESSION,
      bearerToken: "session-b-token",
    });
    await screen.findByTestId("hint-editor");

    resolveRecovery(
      mockJsonResponse(appendVersionResponse(CREATED_HINT_VERSION), {
        etag: '"r5"',
        status: 201,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText(/Created hint-bearing/i)).toBeNull();
    });
    expect(
      screen.queryByText(/Session A hint private/i),
    ).not.toBeInTheDocument();
  });

  it("does not resurrect uncertain after reload resolves last when recover succeeds first", async () => {
    let resolveReloadContent!: (value: Response) => void;
    const reloadContentPromise = new Promise<Response>((resolve) => {
      resolveReloadContent = resolve;
    });
    let appendAttempts = 0;
    let deferReloadContentGet = false;
    const CREATED_V2 = CREATED_HINT_VERSION;

    stubAuthoringFlow((url, init) => {
      if (
        url.includes("/worksheet-learner-hint-versions") &&
        init?.method === "POST"
      ) {
        appendAttempts += 1;
        if (appendAttempts === 1) {
          return mockJsonResponse({ title: "unavailable", status: 503 }, { status: 503 });
        }
        return mockJsonResponse(appendVersionResponse(CREATED_V2), {
          etag: '"r5-after-recovery"',
          status: 201,
        });
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`) && init?.method !== "POST") {
        if (deferReloadContentGet) {
          deferReloadContentGet = false;
          return reloadContentPromise;
        }
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            current_version_id:
              appendAttempts >= 2 ? CREATED_V2 : VERSION_ID,
            stewardship_state: "APPROVED",
          },
          { etag: appendAttempts >= 2 ? '"r5-after-recovery"' : '"r4"' },
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
      "Epoch interleave hint.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    await waitFor(() => screen.getByTestId("recover-original-append"));
    deferReloadContentGet = true;
    await userEvent.click(screen.getByTestId("reload-authoritative-worksheet"));
    await userEvent.click(screen.getByTestId("recover-original-append"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Created hint-bearing/i);
    });
    expect(document.querySelector("[data-author-phase='READY']")).toBeInTheDocument();

    resolveReloadContent(
      mockJsonResponse(
        {
          content_id: CONTENT_ID,
          current_version_id: VERSION_ID,
          stewardship_state: "APPROVED",
        },
        { etag: '"r4"' },
      ),
    );

    await waitFor(() => {
      expect(
        document.querySelector("[data-author-phase='APPEND_OUTCOME_UNCERTAIN']"),
      ).toBeNull();
    });
    expect(screen.getByRole("status")).toHaveTextContent(/Created hint-bearing/i);
  });

  it("prevents duplicate submit with a new idempotency key after success", async () => {
    const submitKeys: string[] = [];
    stubAuthoringFlow((url, init) => {
      if (url.includes("/actions/submit-for-review") && init?.method === "POST") {
        const key = new Headers(init.headers).get("Idempotency-Key");
        if (key) submitKeys.push(key);
        return mockJsonResponse(
          {
            content_id: CONTENT_ID,
            version_id: CREATED_HINT_VERSION,
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
      "Single submit only.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Preview new version/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Create hint-bearing version/i }),
    );
    const submitButton = await screen.findByRole("button", {
      name: /Submit for independent review/i,
    });
    await waitFor(() => expect(submitButton).toBeEnabled());
    await userEvent.click(submitButton);
    await waitFor(() => expect(submitKeys).toHaveLength(1));
    expect(submitButton).toBeDisabled();
    await userEvent.click(submitButton);
    expect(submitKeys).toHaveLength(1);
  });
});