import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CONTENT_ID,
  mockJsonResponse,
  renderApp,
  sampleDetail,
  stubFetch,
  VERSION_ID,
} from "@/test/test-utils";
import {
  answerKeyPayload,
  homeworkPayload,
  lessonPlanPayload,
  quizPayload,
  teacherNotesPayload,
  worksheetPayload,
} from "@/features/teacher-os/artifacts/artifactFixtures";

const DETAIL_PATH = `/teacher-os/review/${CONTENT_ID}/versions/${VERSION_ID}`;

function renderReview(overrides: Record<string, unknown> = {}) {
  const detail = { ...sampleDetail, ...overrides };
  stubFetch((call) => {
    if (call.url.includes("/versions/")) {
      return mockJsonResponse(detail, { etag: '"r2"' });
    }
    return mockJsonResponse({ items: [], next_cursor: null });
  });
  renderApp(DETAIL_PATH);
  return detail;
}

function expectNoTechnicalChrome(payload: unknown) {
  expect(screen.queryByText(/\bETag\b/i)).toBeNull();
  expect(screen.queryByText(/schema_id/i)).toBeNull();
  expect(screen.queryByText(/education\.worksheet/i)).toBeNull();
  expect(screen.queryByText(/Aggregate revision/i)).toBeNull();
  expect(document.querySelector(".safe-json-payload")).toBeNull();
  expect(document.body.textContent).not.toContain(JSON.stringify(payload));
}

describe("TOS-CX01-I02 Review Detail presentation", () => {
  it("renders a worksheet through ArtifactRenderer without JSON or schema chrome", async () => {
    renderReview({
      content_type: "worksheet",
      payload: worksheetPayload,
    });

    expect(
      await screen.findByRole("heading", { name: "Review Worksheet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: sampleDetail.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Which fraction is equivalent to 1/2?"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("artifact-document")).toBeInTheDocument();
    expectNoTechnicalChrome(worksheetPayload);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("renders lesson plan sections", async () => {
    renderReview({
      content_type: "lesson_plan",
      payload: lessonPlanPayload,
    });
    expect(
      await screen.findByRole("heading", { name: "Review Lesson Plan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Lesson sections" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Explore equivalent fractions/i }),
    ).toBeInTheDocument();
    expectNoTechnicalChrome(lessonPlanPayload);
  });

  it("renders a quiz through ArtifactRenderer", async () => {
    renderReview({ content_type: "quiz", payload: quizPayload });
    expect(
      await screen.findByRole("heading", { name: "Review Quick Quiz" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Is 2/4 equal to 1/2?"),
    ).toBeInTheDocument();
    expectNoTechnicalChrome(quizPayload);
  });

  it("renders homework through ArtifactRenderer", async () => {
    renderReview({ content_type: "homework", payload: homeworkPayload });
    expect(
      await screen.findByRole("heading", { name: "Review Homework" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Complete at home.")).toBeInTheDocument();
    expectNoTechnicalChrome(homeworkPayload);
  });

  it("renders an answer key through ArtifactRenderer", async () => {
    renderReview({ content_type: "answer_key", payload: answerKeyPayload });
    expect(
      await screen.findByRole("heading", { name: "Review Answer Key" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Two quarters equal one half."),
    ).toBeInTheDocument();
    expectNoTechnicalChrome(answerKeyPayload);
  });

  it("renders teacher notes through ArtifactRenderer", async () => {
    renderReview({
      content_type: "teacher_notes",
      payload: teacherNotesPayload,
    });
    expect(
      await screen.findByRole("heading", { name: "Review Teacher Notes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Watch for common half/quarter confusion."),
    ).toBeInTheDocument();
    expectNoTechnicalChrome(teacherNotesPayload);
  });
});
