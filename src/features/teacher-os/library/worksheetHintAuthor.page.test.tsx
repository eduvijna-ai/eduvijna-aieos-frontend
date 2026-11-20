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
});