import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  isWorkArtifactsPath,
  isWorkGetPath,
  mockJsonResponse,
  renderApp,
  sampleContentResponse,
  samplePreparationKitArtifacts,
  sampleWork,
  stubFetch,
  WORK_ID,
} from "@/test/test-utils";
import type { WorkArtifactItem } from "@/services/api/generated/teachingTypes";

const WORK_ROUTE = `/teacher-os/work/${WORK_ID}`;
const CANONICAL_LABELS = [
  "Lesson Plan",
  "Worksheet",
  "Quick Quiz",
  "Homework",
  "Answer Key",
  "Teacher Notes",
];
const LONG_EXPLANATION =
  "AlignedAlignedAlignedAlignedAlignedAlignedAlignedAlignedAlignedAlignedAlignedAlignedAlignedAlignedAlignedWithoutSpaces";

function withQuality(
  items: WorkArtifactItem[],
  checks: NonNullable<WorkArtifactItem["educational_quality"]>["checks"],
  status = "PASS",
): ReturnType<typeof samplePreparationKitArtifacts> {
  return {
    work_id: WORK_ID,
    items: items.map((item) => ({
      ...item,
      educational_quality: { status, checks },
    })),
  };
}

function stubKit(
  artifacts = samplePreparationKitArtifacts(),
) {
  return stubFetch((call) => {
    if (isWorkArtifactsPath(call.url)) {
      return mockJsonResponse(artifacts);
    }
    if (isWorkGetPath(call.url)) {
      return mockJsonResponse(sampleWork, { etag: '"r1"' });
    }
    const contentMatch = call.url.match(/^\/api\/v1\/contents\/([^/?]+)$/);
    if (contentMatch && call.method === "GET") {
      const contentId = contentMatch[1];
      const item = artifacts.items.find((row) => row.content_id === contentId);
      return mockJsonResponse(
        sampleContentResponse({
          content_id: contentId,
          current_version_id: item?.version_id ?? contentId,
          stewardship_state: item?.stewardship_state ?? "IN_REVIEW",
          title: item?.title ?? "Artifact",
          content_type: item?.content_type ?? "worksheet",
          published_version_id: null,
        }),
        { etag: '"r3"' },
      );
    }
    return mockJsonResponse({ title: "Not Found", status: 404 }, { status: 404 });
  });
}

describe("TOS-CX01-I02 Preparation kit presentation", () => {
  it("renders six humanized cards with quality summary and no technical metadata", async () => {
    const calls = stubKit();
    renderApp(WORK_ROUTE);

    await screen.findByRole("heading", { name: /Preparation kit/i });
    for (const label of CANONICAL_LABELS) {
      expect(
        screen.getByRole("heading", { level: 3, name: label }),
      ).toBeInTheDocument();
    }

    const worksheet = screen
      .getByRole("heading", { name: "Worksheet" })
      .closest("article")!;
    expect(within(worksheet).getByText("In Review")).toBeInTheDocument();
    expect(
      within(worksheet).getByText("Practice activities for learners"),
    ).toBeInTheDocument();
    expect(
      within(worksheet).getByText(/2 quality checks passed/i),
    ).toBeInTheDocument();
    expect(within(worksheet).queryByText(/age_appropriate/i)).toBeNull();
    expect(within(worksheet).queryByText(/curriculum_aligned/i)).toBeNull();
    expect(
      within(worksheet).getByRole("link", { name: /Review Worksheet/i }),
    ).toBeInTheDocument();
    expect(
      within(worksheet).queryByRole("button", { name: "Publish" }),
    ).toBeNull();

    expect(document.body.textContent).not.toMatch(/\bETag\b/i);
    expect(document.body.textContent).not.toMatch(/aggregate revision/i);
    expect(document.body.textContent).not.toMatch(/These values come from the server/i);

    expect(
      calls.some(
        (call) => call.method === "GET" && isWorkGetPath(call.url),
      ),
    ).toBe(true);
  });

  it("discloses human quality labels, including unknown-code fallback", async () => {
    const artifacts = withQuality(samplePreparationKitArtifacts().items, [
      {
        code: "schema_valid",
        passed: true,
        explanation: LONG_EXPLANATION,
      },
      {
        code: "student_support_alignment",
        passed: true,
        explanation: "Support notes are present.",
      },
    ]);
    stubKit(artifacts);
    renderApp(WORK_ROUTE);

    const worksheet = (
      await screen.findByRole("heading", { name: "Worksheet" })
    ).closest("article")!;
    expect(within(worksheet).queryByText(/schema_valid/i)).toBeNull();
    expect(
      within(worksheet).queryByText(/student_support_alignment/i),
    ).toBeNull();

    const summary = within(worksheet).getByText("View quality details");
    await userEvent.click(summary);
    const details = summary.closest("details");
    if (details && !details.open) {
      details.open = true;
    }
    expect(
      within(worksheet).getByText(/Content structure valid/),
    ).toBeInTheDocument();
    expect(
      within(worksheet).getByText(/Student support alignment/i),
    ).toBeInTheDocument();
    expect(within(worksheet).queryByText("schema_valid")).toBeNull();
    const explanation = within(worksheet).getByText(LONG_EXPLANATION);
    expect(explanation.className).toMatch(/work-eq-explanation/);
  });

  it("keeps Publish only when lifecycle says the approved version is eligible", async () => {
    const artifacts = samplePreparationKitArtifacts();
    artifacts.items = artifacts.items.map((item) =>
      item.artifact_kind === "worksheet"
        ? { ...item, stewardship_state: "APPROVED" }
        : item,
    );
    stubKit(artifacts);
    renderApp(WORK_ROUTE);

    const worksheet = (
      await screen.findByRole("heading", { name: "Worksheet" })
    ).closest("article")!;
    expect(
      await within(worksheet).findByRole("button", { name: "Publish" }),
    ).toBeInTheDocument();
    expect(within(worksheet).getByRole("link", { name: "View" })).toBeInTheDocument();
    expect(
      within(worksheet).queryByRole("link", { name: /Review Worksheet/i }),
    ).toBeNull();
  });
});
