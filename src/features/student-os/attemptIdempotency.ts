import type {
  AttemptResponseWriteRequest,
  LearnerQuestionResponse,
} from "@/services/api/studentLearningApi";

export type DraftAnswer = {
  choiceValue?: string;
  textValue?: string;
  booleanValue?: boolean;
};

export function parseRevisionFromEtag(etag: string | null): number | null {
  if (!etag) return null;
  const match = /^"r(0|[1-9][0-9]*)"$/.exec(etag.trim());
  if (!match) return null;
  return Number(match[1]);
}

export function revisionEtag(revision: number): string {
  return `"r${revision}"`;
}

export function retainOrMintIdempotencyKey(
  material: string,
  keyRef: { current: string | null },
  materialRef: { current: string | null },
  mint: () => string = () => crypto.randomUUID(),
): string {
  if (materialRef.current !== material) {
    keyRef.current = null;
    materialRef.current = material;
  }
  if (!keyRef.current) {
    keyRef.current = mint();
  }
  return keyRef.current;
}

export function startAttemptMaterial(assignmentId: string): string {
  return JSON.stringify({ assignment_id: assignmentId });
}

export function saveResponsesMaterial(input: {
  attemptId: string;
  expectedAggregateRevision: number;
  responses: AttemptResponseWriteRequest[];
}): string {
  return JSON.stringify({
    attempt_id: input.attemptId,
    expected_aggregate_revision: input.expectedAggregateRevision,
    responses: input.responses,
  });
}

export function submitAttemptMaterial(input: {
  attemptId: string;
  expectedAggregateRevision: number;
}): string {
  return JSON.stringify({
    attempt_id: input.attemptId,
    expected_aggregate_revision: input.expectedAggregateRevision,
    action: "submit",
  });
}

export function serializeLearnerResponses(
  questions: readonly LearnerQuestionResponse[],
  answers: Record<string, DraftAnswer>,
): AttemptResponseWriteRequest[] {
  const writes: AttemptResponseWriteRequest[] = [];
  for (const question of questions) {
    const answer = answers[question.id];
    if (!answer) continue;
    if (question.question_type === "TRUE_FALSE") {
      if (typeof answer.booleanValue !== "boolean") continue;
      writes.push({
        question_id: question.id,
        response_kind: "TRUE_FALSE",
        boolean_value: answer.booleanValue,
        choice_value: null,
        text_value: null,
      });
      continue;
    }
    if (question.question_type === "MULTIPLE_CHOICE") {
      const choice = answer.choiceValue?.trim();
      if (!choice) continue;
      writes.push({
        question_id: question.id,
        response_kind: "MULTIPLE_CHOICE",
        choice_value: choice,
        boolean_value: null,
        text_value: null,
      });
      continue;
    }
    if (question.question_type === "SHORT_ANSWER") {
      const text = answer.textValue?.trim();
      if (!text) continue;
      writes.push({
        question_id: question.id,
        response_kind: "SHORT_ANSWER",
        text_value: text,
        boolean_value: null,
        choice_value: null,
      });
    }
  }
  return writes;
}

export function draftsFromSavedResponses(
  responses: readonly {
    question_id: string;
    response_kind: string;
    choice_value: string | null;
    text_value: string | null;
    boolean_value: boolean | null;
  }[],
): Record<string, DraftAnswer> {
  const drafts: Record<string, DraftAnswer> = {};
  for (const item of responses) {
    if (item.response_kind === "TRUE_FALSE") {
      if (typeof item.boolean_value === "boolean") {
        drafts[item.question_id] = { booleanValue: item.boolean_value };
      }
      continue;
    }
    if (item.response_kind === "MULTIPLE_CHOICE" && item.choice_value) {
      drafts[item.question_id] = { choiceValue: item.choice_value };
      continue;
    }
    if (item.response_kind === "SHORT_ANSWER" && item.text_value) {
      drafts[item.question_id] = { textValue: item.text_value };
    }
  }
  return drafts;
}
