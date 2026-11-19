import type { LearnerHintsResponse } from "@/services/api/studentLearningApi";

export type VerifiedLearnerHintOutcome =
  | { kind: "hint"; text: string }
  | { kind: "empty" }
  | { kind: "mismatch" };

export function verifyLearnerHintForQuestion(
  body: LearnerHintsResponse,
  context: {
    attemptId: string;
    contentVersionId: string;
    questionId: string;
    questionIds: readonly string[];
  },
): VerifiedLearnerHintOutcome {
  if (body.attempt_id !== context.attemptId) {
    return { kind: "mismatch" };
  }
  if (body.content_version_id !== context.contentVersionId) {
    return { kind: "mismatch" };
  }
  if (!context.questionIds.includes(context.questionId)) {
    return { kind: "mismatch" };
  }
  const item = body.hints.find((hint) => hint.question_id === context.questionId);
  if (!item?.hint_text) {
    return { kind: "empty" };
  }
  return { kind: "hint", text: item.hint_text };
}