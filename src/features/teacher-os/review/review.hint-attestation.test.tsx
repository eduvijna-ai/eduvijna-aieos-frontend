import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CONTENT_ID,
  DEV_SESSION,
  connectDevSession,
  mockJsonResponse,
  renderApp,
  renderWithProviders,
  sampleDetail,
  sampleQueueItem,
  VERSION_ID,
} from "@/test/test-utils";
import { worksheetPayload } from "@/features/teacher-os/artifacts/artifactFixtures";
import {
  WorksheetHintReviewPanel,
  resetHintReviewResourceEpochForTests,
} from "./WorksheetHintReviewPanel";

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
  beforeEach(() => {
    resetHintReviewResourceEpochForTests();
  });

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

  it("does not treat a stale deferred attestation POST as success after payload refresh on same mount", async () => {
    let resolveAttestation!: (value: Response) => void;
    const attestationPromise = new Promise<Response>((resolve) => {
      resolveAttestation = resolve;
    });
    const onRecorded = vi.fn();

    const payloadA = {
      ...hintPayload,
      questions: hintPayload.questions.map((question, index) =>
        index === 0
          ? { ...question, learner_hint: "Payload A hint." }
          : question,
      ),
    };
    const payloadB = {
      ...hintPayload,
      questions: hintPayload.questions.map((question, index) =>
        index === 0
          ? { ...question, learner_hint: "Payload B hint." }
          : question,
      ),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("record-worksheet-hint-attestation")) {
          return attestationPromise;
        }
        return mockJsonResponse({ items: [] });
      }),
    );

    const { rerender } = renderWithProviders(
      <WorksheetHintReviewPanel
        contentId={CONTENT_ID}
        versionId={VERSION_ID}
        schemaId="education.worksheet"
        schemaVersion={2}
        payload={payloadA}
        contentEtag='"etag-a"'
        session={DEV_SESSION}
        resourceGeneration={1}
        reviewResourceEpoch={1}
        onAttestationRecorded={onRecorded}
      />,
    );

    await screen.findByTestId("worksheet-hint-review");
    for (const checkbox of screen.getAllByRole("checkbox")) {
      await userEvent.click(checkbox);
    }
    await userEvent.click(
      screen.getByRole("button", { name: /Record structured attestation/i }),
    );

    rerender(
      <WorksheetHintReviewPanel
        contentId={CONTENT_ID}
        versionId={VERSION_ID}
        schemaId="education.worksheet"
        schemaVersion={2}
        payload={payloadB}
        contentEtag='"etag-b"'
        session={DEV_SESSION}
        resourceGeneration={1}
        reviewResourceEpoch={2}
        onAttestationRecorded={onRecorded}
      />,
    );

    resolveAttestation(
      mockJsonResponse(
        {
          attestation_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          content_id: CONTENT_ID,
          version_id: VERSION_ID,
        },
        { etag: '"etag-c"', status: 201 },
      ),
    );

    await waitFor(() => {
      expect(onRecorded).not.toHaveBeenCalled();
    });
    expect(screen.queryByText(/Attestation recorded/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /Record structured attestation/i }),
    ).toBeDisabled();
  });

  it("does not record attestation from a late POST after unmount", async () => {
    let resolveAttestation!: (value: Response) => void;
    const attestationPromise = new Promise<Response>((resolve) => {
      resolveAttestation = resolve;
    });
    const onRecorded = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("record-worksheet-hint-attestation")) {
          return attestationPromise;
        }
        return mockJsonResponse({ items: [] });
      }),
    );

    const { unmount } = renderWithProviders(
      <WorksheetHintReviewPanel
        contentId={CONTENT_ID}
        versionId={VERSION_ID}
        schemaId="education.worksheet"
        schemaVersion={2}
        payload={hintPayload}
        contentEtag='"etag-a"'
        session={DEV_SESSION}
        resourceGeneration={1}
        reviewResourceEpoch={3}
        onAttestationRecorded={onRecorded}
      />,
    );

    await screen.findByTestId("worksheet-hint-review");
    for (const checkbox of screen.getAllByRole("checkbox")) {
      await userEvent.click(checkbox);
    }
    await userEvent.click(
      screen.getByRole("button", { name: /Record structured attestation/i }),
    );

    unmount();

    resolveAttestation(
      mockJsonResponse(
        {
          attestation_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          content_id: CONTENT_ID,
          version_id: VERSION_ID,
        },
        { etag: '"etag-c"', status: 201 },
      ),
    );

    await waitFor(() => {
      expect(onRecorded).not.toHaveBeenCalled();
    });
  });

  it("rejects stale attestation on ReviewDetailPage after silent loadDetail refresh", async () => {
    let resolveAttestation!: (value: Response) => void;
    const attestationPromise = new Promise<Response>((resolve) => {
      resolveAttestation = resolve;
    });

    const payloadA = {
      ...hintPayload,
      questions: hintPayload.questions.map((question, index) =>
        index === 0
          ? { ...question, learner_hint: "Silent refresh A." }
          : question,
      ),
    };
    const payloadB = {
      ...hintPayload,
      questions: hintPayload.questions.map((question, index) =>
        index === 0
          ? { ...question, learner_hint: "Silent refresh B." }
          : question,
      ),
    };

    let activePayload: unknown = payloadA;
    let contentEtag = '"etag-a"';
    let reviewDetailCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.includes("/teacher-os/review-queue/") &&
          !url.endsWith("review-queue")
        ) {
          reviewDetailCalls += 1;
          if (reviewDetailCalls >= 2) {
            activePayload = payloadB;
            contentEtag = '"etag-b"';
          }
          return mockJsonResponse(
            { ...hintedDetail, payload: activePayload },
            { etag: '"r2"' },
          );
        }
        if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`)) {
          return mockJsonResponse(
            { content_id: CONTENT_ID, current_version_id: VERSION_ID },
            { etag: contentEtag },
          );
        }
        if (url.includes("record-worksheet-hint-attestation")) {
          return attestationPromise;
        }
        if (url.includes("/actions/approve") && init?.method === "POST") {
          return mockJsonResponse(
            { title: "Precondition failed", status: 412, detail: {} },
            { status: 412 },
          );
        }
        return mockJsonResponse({ items: [] });
      }),
    );

    connectDevSession(DEV_SESSION);
    renderApp(detailPath);

    await screen.findByTestId("worksheet-hint-review");
    for (const checkbox of screen.getAllByRole("checkbox")) {
      await userEvent.click(checkbox);
    }
    await userEvent.click(
      screen.getByRole("button", { name: /Record structured attestation/i }),
    );

    await userEvent.click(screen.getByRole("button", { name: /^Approve$/i }));

    await waitFor(() => {
      expect(reviewDetailCalls).toBeGreaterThanOrEqual(2);
    });

    resolveAttestation(
      mockJsonResponse(
        {
          attestation_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          content_id: CONTENT_ID,
          version_id: VERSION_ID,
        },
        { etag: '"etag-stale"', status: 201 },
      ),
    );

    await waitFor(() => {
      expect(
        screen.queryByText(/Structured hint attestation is recorded/i),
      ).toBeNull();
    });
    expect(
      screen.getByRole("button", { name: /Record structured attestation/i }),
    ).toBeDisabled();

    vi.mocked(fetch).mockImplementation(async (input, init?: RequestInit) => {
      const url = String(input);
      if (
        url.includes("/teacher-os/review-queue/") &&
        !url.endsWith("review-queue")
      ) {
        return mockJsonResponse(
          { ...hintedDetail, payload: payloadB },
          { etag: '"r2"' },
        );
      }
      if (url.endsWith(`/api/v1/contents/${CONTENT_ID}`)) {
        return mockJsonResponse(
          { content_id: CONTENT_ID, current_version_id: VERSION_ID },
          { etag: '"etag-b"' },
        );
      }
      if (
        url.includes("record-worksheet-hint-attestation") &&
        init?.method === "POST"
      ) {
        return mockJsonResponse(
          {
            attestation_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            content_id: CONTENT_ID,
            version_id: VERSION_ID,
          },
          { etag: '"etag-fresh"', status: 201 },
        );
      }
      return mockJsonResponse({ items: [] });
    });

    for (const checkbox of screen.getAllByRole("checkbox")) {
      await userEvent.click(checkbox);
    }
    await userEvent.click(
      screen.getByRole("button", { name: /Record structured attestation/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Structured hint attestation is recorded/i),
      ).toBeInTheDocument();
    });
  });
});