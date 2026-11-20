import { describe, expect, it } from "vitest";
import { worksheetPayload } from "@/features/teacher-os/artifacts/artifactFixtures";
import { hintTextScalarCount } from "@/features/student-os/attempts/learnerHintPolicy";
import {
  buildWorksheetHintAppendPayload,
  countAppendableHints,
  listHintedWorksheetQuestions,
  parseWorksheetHintSource,
  validateDraftHintText,
  worksheetHintPayloadHasInvalidLearnerHintKey,
  worksheetQuestionCountEligibleForHintAuthoring,
} from "./worksheetHintAuthorPolicy";

describe("worksheetHintAuthorPolicy", () => {
  it("preserves non-hint worksheet fields when building append payload", () => {
    const source = parseWorksheetHintSource(worksheetPayload);
    expect(source.ok).toBe(true);
    if (!source.ok) return;

    const next = buildWorksheetHintAppendPayload(source.payload, {
      "q-1": "Think about equal parts.",
    });
    expect(next.title).toBe(worksheetPayload.title);
    expect(next.teacher_notes).toBe(worksheetPayload.teacher_notes);
    const q1 = (next.questions as Record<string, unknown>[]).find(
      (q) => (q as { id?: string }).id === "q-1",
    ) as { learner_hint?: string; answer?: string };
    expect(q1.learner_hint).toBe("Think about equal parts.");
    expect(q1.answer).toBe(worksheetPayload.questions[0].answer);
    const q2 = (next.questions as Record<string, unknown>[]).find(
      (q) => (q as { id?: string }).id === "q-2",
    ) as { learner_hint?: string };
    expect("learner_hint" in q2).toBe(false);
  });

  it("enforces 500/501 Unicode scalar boundaries", () => {
    const ok500 = "😀".repeat(500);
    const bad501 = "😀".repeat(501);
    expect(hintTextScalarCount(ok500)).toBe(500);
    expect(validateDraftHintText(ok500).ok).toBe(true);
    expect(validateDraftHintText(bad501).ok).toBe(false);
  });

  it("rejects HTML, URLs, and answer copying", () => {
    expect(validateDraftHintText("<b>hint</b>").ok).toBe(false);
    expect(validateDraftHintText("visit https://example.com").ok).toBe(false);
    const copy = validateDraftHintText("2/4", {
      answer: "2/4",
      explanation: "Any even numerator/denominator pair can work.",
    });
    expect(copy.ok).toBe(false);
  });

  it("flags invalid learner_hint keys for reviewer fail-closed handling", () => {
    const invalid = {
      ...worksheetPayload,
      questions: worksheetPayload.questions.map((question, index) =>
        index === 0 ? { ...question, learner_hint: "" } : question,
      ),
    };
    expect(worksheetHintPayloadHasInvalidLearnerHintKey(invalid)).toMatch(
      /invalid learner_hint/i,
    );
  });

  it("requires between six and twelve questions for authoring eligibility", () => {
    expect(worksheetQuestionCountEligibleForHintAuthoring(6)).toBe(true);
    expect(worksheetQuestionCountEligibleForHintAuthoring(12)).toBe(true);
    expect(worksheetQuestionCountEligibleForHintAuthoring(5)).toBe(false);
    expect(worksheetQuestionCountEligibleForHintAuthoring(13)).toBe(false);
  });

  it("counts appendable hints and lists hinted questions", () => {
    const withHints = buildWorksheetHintAppendPayload(worksheetPayload, {
      "q-1": "Look at equal parts.",
      "q-2": "",
    });
    expect(
      countAppendableHints(worksheetPayload, { "q-1": "Look at equal parts." }),
    ).toBe(1);
    const hinted = listHintedWorksheetQuestions(withHints);
    expect(hinted?.map((item) => item.questionId)).toEqual(["q-1"]);
  });
});