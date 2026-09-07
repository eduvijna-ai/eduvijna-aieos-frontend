import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArtifactRenderer } from "./ArtifactRenderer";
import {
  answerKeyPayload,
  homeworkPayload,
  lessonPlanPayload,
  longPrompt,
  longWorksheetPayload,
  quizPayload,
  teacherNotesPayload,
  worksheetPayload,
} from "./artifactFixtures";

function renderArtifact(contentType: string, payload: unknown) {
  return render(
    <ArtifactRenderer contentType={contentType} payload={payload} />,
  );
}

function expectNoRawJson(container: HTMLElement, payload: unknown) {
  expect(container.textContent).not.toContain(JSON.stringify(payload));
  expect(container.querySelector("pre")).toBeNull();
  expect(screen.queryByText(/objective_ids/i)).toBeNull();
  expect(screen.queryByText(/source_question_id/i)).toBeNull();
  expect(screen.queryByText(/schema_id/i)).toBeNull();
  expect(screen.queryByText(/payload_sha256/i)).toBeNull();
}

describe("ArtifactRenderer", () => {
  it("lesson_plan renders human sections and mapped objective text", () => {
    const { container } = renderArtifact("lesson_plan", lessonPlanPayload);
    expect(
      screen.getByRole("article", { name: "Lesson Plan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fractions lesson" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Learning objectives" })).toBeInTheDocument();
    expect(screen.getByText("Identify equivalent fractions")).toBeInTheDocument();
    expect(screen.getByText("fraction tiles")).toBeInTheDocument();
    expect(
      screen.getByText("Activate prior knowledge with a pizza model."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "1. Explore equivalent fractions" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Focus: Identify equivalent fractions/)).toBeInTheDocument();
    expect(screen.getByText("Demonstrate halves and quarters.")).toBeInTheDocument();
    expect(screen.getByText("Ask one exit ticket question.")).toBeInTheDocument();
    expect(screen.queryByText("obj-1")).toBeNull();
    expect(screen.queryByText("sec-1")).toBeNull();
    expectNoRawJson(container, lessonPlanPayload);
  });

  it("worksheet renders instructions and questions without answers or JSON", () => {
    const { container } = renderArtifact("worksheet", worksheetPayload);
    const doc = screen.getByRole("article", { name: "Worksheet" });
    expect(
      screen.getByRole("heading", { name: "Fractions Worksheet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Practice worksheet for visual fractions.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Learning goals" })).toBeInTheDocument();
    expect(screen.getByText("Complete the following questions.")).toBeInTheDocument();
    expect(
      screen.getByText("Which fraction is equivalent to 1/2?"),
    ).toBeInTheDocument();
    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(screen.getByText("Multiple choice")).toBeInTheDocument();
    expect(screen.getByText("Visual: A circle split into two equal parts.")).toBeInTheDocument();
    expect(within(doc).queryByText("Two quarters equal one half.")).toBeNull();
    expect(within(doc).queryByText("Review visual models before assigning.")).toBeNull();
    expect(screen.queryByText(/"questions"/)).toBeNull();
    expectNoRawJson(container, worksheetPayload);
  });

  it("quiz renders as Quick Quiz with questions and no inline answers", () => {
    const { container } = renderArtifact("quiz", quizPayload);
    expect(screen.getByRole("article", { name: "Quick Quiz" })).toBeInTheDocument();
    expect(screen.getByText("Quick Quiz")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fractions quiz" })).toBeInTheDocument();
    expect(screen.getByText("Is 2/4 equal to 1/2?")).toBeInTheDocument();
    expect(screen.getByText("True or false")).toBeInTheDocument();
    expect(screen.queryByText("They represent the same amount.")).toBeNull();
    expect(screen.queryByText(/^quiz$/i)).toBeNull();
    expectNoRawJson(container, quizPayload);
  });

  it("homework renders questions without JSON or internal IDs", () => {
    const { container } = renderArtifact("homework", homeworkPayload);
    expect(screen.getByRole("article", { name: "Homework" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fractions homework" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Complete at home.")).toBeInTheDocument();
    expect(screen.getByText("Shade a model that shows 1/2.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Homework questions" })).toBeInTheDocument();
    expect(screen.queryByText("h-1")).toBeNull();
    expect(screen.queryByText(/Any model with half shaded/)).toBeNull();
    expectNoRawJson(container, homeworkPayload);
  });

  it("answer_key renders grouped answers and explanations", () => {
    const { container } = renderArtifact("answer_key", answerKeyPayload);
    expect(screen.getByRole("article", { name: "Answer Key" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fractions answer key" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Worksheet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quick Quiz" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Homework" })).toBeInTheDocument();
    expect(screen.getByText("Two quarters equal one half.")).toBeInTheDocument();
    expect(screen.getByText("They represent the same amount.")).toBeInTheDocument();
    expect(screen.getByText("Equal parts must be the same size.")).toBeInTheDocument();
    expect(screen.queryByText("q-1")).toBeNull();
    expect(screen.queryByText("source_question_id")).toBeNull();
    expectNoRawJson(container, answerKeyPayload);
  });

  it("teacher_notes renders readable note list", () => {
    const { container } = renderArtifact("teacher_notes", teacherNotesPayload);
    expect(screen.getByRole("article", { name: "Teacher Notes" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fractions teaching notes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Watch for common half/quarter confusion."),
    ).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expectNoRawJson(container, teacherNotesPayload);
  });

  it("unknown content type fails safely without JSON", () => {
    const payload = { title: "Mystery", questions: [] };
    const { container } = renderArtifact("unknown.kind", payload);
    expect(
      screen.getByText("This resource isn’t ready to preview"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Worksheet" })).toBeNull();
    expectNoRawJson(container, payload);
  });

  it("invalid worksheet payload fails safely without inferring type from keys", () => {
    const payload = {
      title: "Looks like a worksheet",
      questions: [{ prompt: "Not enough structure" }],
    };
    const { container } = renderArtifact("worksheet", payload);
    expect(
      screen.getByText("This resource isn’t ready to preview"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Looks like a worksheet")).toBeNull();
    expectNoRawJson(container, payload);
  });

  it("dispatches from content_type rather than payload shape", () => {
    renderArtifact("lesson_plan", worksheetPayload);
    expect(
      screen.getByText("This resource isn’t ready to preview"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Complete the following questions.")).toBeNull();
  });

  it("keeps long question text in the document", () => {
    const { container } = renderArtifact("worksheet", longWorksheetPayload);
    expect(screen.getByText(longPrompt)).toBeInTheDocument();
    const documentEl = container.querySelector(".artifact-document");
    expect(documentEl).toBeTruthy();
    expect((documentEl as HTMLElement).textContent).toContain(longPrompt);
    expectNoRawJson(container, longWorksheetPayload);
  });
});
