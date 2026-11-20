import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CONTENT_ID,
  mockJsonResponse,
  renderApp,
  sampleDetail,
  sampleQueueItem,
  VERSION_ID,
} from "@/test/test-utils";
import { worksheetPayload } from "@/features/teacher-os/artifacts/artifactFixtures";

const detailPath = `/teacher-os/review/${CONTENT_ID}/versions/${VERSION_ID}`;

const hintPayload = {
  ...worksheetPayload,
  questions: worksheetPayload.questions.map((question: (typeof worksheetPayload.questions)[number], index: number) =>
    index === 0
      ? { ...question, learner_hint: "Think about equal parts." }
      : question,
  ),
};

const hintedDetail = {
  ...sampleDetail,
  schema_version: 2,
  payload: hintPayload,
};

describe("Worksheet hint attestation review", () => {
  it("requires explicit per-question booleans before attestation POST", async () => {
  vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.includes("/teacher-os/review-queue/") &&
          !url.endsWith("review-queue")
        ) {
          return mockJsonResponse(hintedDetail, { etag: '"r2"' });
        }
        if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`)) {
          return mockJsonResponse(
            { content_id: CONTENT_ID, current_version_id: VERSION_ID },
            { etag: '"r9"' },
          );
        }
        if (url.includes("record-worksheet-hint-attestation")) {
          const body = JSON.parse(String(init?.body));
          expect(body.per_question_outcomes).toHaveLength(1);
          expect(body.per_question_outcomes[0]).toEqual({
            question_id: "q-1",
            hard_block_clear: true,
            human_review_pass: true,
          });
          return mockJsonResponse(
            {
              attestation_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
              content_id: CONTENT_ID,
              version_id: VERSION_ID,
            },
            { etag: '"r10"', status: 201 },
          );
        }
        return mockJsonResponse({ items: [] });
      }),
    );

    renderApp(detailPath);
    await screen.findByTestId("worksheet-hint-review");

    const recordButton = screen.getByRole("button", {
      name: /Record structured attestation/i,
    });
    expect(recordButton).toBeDisabled();

    const checkboxes = screen.getAllByRole("checkbox");
    for (const checkbox of checkboxes) {
      await userEvent.click(checkbox);
    }
    await userEvent.click(
      screen.getByRole("button", { name: /Record structured attestation/i }),
    );

    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.some((call) =>
          String(call[0]).includes("record-worksheet-hint-attestation"),
        ),
      ).toBe(true);
    });
  });

  it("does not show hint attestation panel for hint-free worksheets", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (
        url.includes("/teacher-os/review-queue/") &&
        !url.endsWith("review-queue")
      ) {
        return mockJsonResponse(sampleDetail, { etag: '"r2"' });
      }
      return mockJsonResponse({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp(detailPath);
    await screen.findByRole("heading", { name: sampleQueueItem.title });
    expect(screen.queryByTestId("worksheet-hint-review")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).endsWith(`/api/v1/contents/${CONTENT_ID}`),
      ),
    ).toBe(false);
  });

  it("resets attestation checkboxes when the reviewed version changes", async () => {
    const versionA = {
      ...hintedDetail,
      version_number: 2,
      payload: {
        ...hintPayload,
        questions: hintPayload.questions.map(
          (question: (typeof hintPayload.questions)[number], index: number) =>
            index === 0
              ? { ...question, learner_hint: "Version A hint." }
              : question,
        ),
      },
    };
    const versionB = {
      ...hintedDetail,
      version_number: 3,
      payload: {
        ...hintPayload,
        questions: hintPayload.questions.map(
          (question: (typeof hintPayload.questions)[number], index: number) =>
            index === 0
              ? { ...question, learner_hint: "Version B hint." }
              : question,
        ),
      },
    };

    let activeDetail = versionA;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (
          url.includes("/teacher-os/review-queue/") &&
          !url.endsWith("review-queue")
        ) {
          return mockJsonResponse(activeDetail, { etag: '"r2"' });
        }
        if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`)) {
          return mockJsonResponse(
            { content_id: CONTENT_ID, current_version_id: VERSION_ID },
            { etag: '"r9"' },
          );
        }
        return mockJsonResponse({ items: [] });
      }),
    );

    const { unmount } = renderApp(detailPath);
    await screen.findByTestId("worksheet-hint-review");
    const checkboxes = screen.getAllByRole("checkbox");
    for (const checkbox of checkboxes) {
      await userEvent.click(checkbox);
    }
    expect(
      screen.getByRole("button", { name: /Record structured attestation/i }),
    ).toBeEnabled();

    activeDetail = versionB;
    unmount();
    renderApp(detailPath);
    await screen.findByTestId("worksheet-hint-review");
    expect(
      screen.getByRole("button", { name: /Record structured attestation/i }),
    ).toBeDisabled();
  });
});