import { hintTextScalarCount } from "@/features/student-os/attempts/learnerHintPolicy";

export const WORKSHEET_SCHEMA_ID = "education.worksheet";
export const WORKSHEET_HINT_SCHEMA_VERSION = 2;
export const WORKSHEET_HINT_SCHEMA_VERSION_LEGACY = 1;

export type HintFieldIssue =
  | "blank"
  | "too_long"
  | "html"
  | "url"
  | "pii"
  | "answer_copy"
  | "grade_language";

export type HintValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; issue: HintFieldIssue };

export type WorksheetHintSource =
  | { ok: true; payload: Record<string, unknown>; questionIds: string[] }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const HTML_TAG = /<[^>]+>/i;
const URL_PATTERN =
  /\b(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|org|edu|net)\b)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /\b(?:\+?\d[\d\s().-]{7,}\d)\b/;
const GRADE_PATTERN =
  /\b(?:grade|score|points?|%|correct answer|the answer is)\b/i;

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function overlapsAnswerMaterial(
  hint: string,
  answer?: unknown,
  explanation?: unknown,
): boolean {
  const hintNorm = normalizeComparable(hint);
  if (hintNorm.length < 3) return false;
  for (const field of [answer, explanation]) {
    if (typeof field !== "string") continue;
    const fieldNorm = normalizeComparable(field);
    if (!fieldNorm) continue;
    if (fieldNorm === hintNorm || fieldNorm.includes(hintNorm)) {
      return true;
    }
    if (hintNorm.includes(fieldNorm) && fieldNorm.length >= 4) {
      return true;
    }
  }
  return false;
}

export function validateDraftHintText(
  raw: string,
  question?: { answer?: unknown; explanation?: unknown },
): HintValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, issue: "blank" };
  }
  const scalarCount = hintTextScalarCount(trimmed);
  if (scalarCount > 500) {
    return { ok: false, issue: "too_long" };
  }
  if (HTML_TAG.test(trimmed)) {
    return { ok: false, issue: "html" };
  }
  if (URL_PATTERN.test(trimmed)) {
    return { ok: false, issue: "url" };
  }
  if (EMAIL_PATTERN.test(trimmed) || PHONE_PATTERN.test(trimmed)) {
    return { ok: false, issue: "pii" };
  }
  if (GRADE_PATTERN.test(trimmed)) {
    return { ok: false, issue: "grade_language" };
  }
  if (question && overlapsAnswerMaterial(trimmed, question.answer, question.explanation)) {
    return { ok: false, issue: "answer_copy" };
  }
  return { ok: true, normalized: trimmed };
}

export function normalizeStoredHintText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const scalarCount = hintTextScalarCount(trimmed);
  if (scalarCount < 1 || scalarCount > 500) return null;
  return trimmed;
}

export function parseWorksheetHintSource(payload: unknown): WorksheetHintSource {
  if (!isRecord(payload)) {
    return { ok: false, reason: "Worksheet payload is not a valid object." };
  }
  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    return { ok: false, reason: "Worksheet has no questions to attach hints." };
  }
  const questionIds: string[] = [];
  for (const question of payload.questions) {
    if (!isRecord(question)) {
      return { ok: false, reason: "A worksheet question is malformed." };
    }
    const id = asTrimmedString(question.id);
    if (!id) {
      return { ok: false, reason: "Every worksheet question needs a stable id." };
    }
    if (questionIds.includes(id)) {
      return { ok: false, reason: "Worksheet question ids must be unique." };
    }
    questionIds.push(id);
  }
  return { ok: true, payload: structuredClone(payload), questionIds };
}

export function worksheetSchemaEligible(
  schemaId: string | null | undefined,
  schemaVersion: number | null | undefined,
): boolean {
  if (schemaId !== WORKSHEET_SCHEMA_ID) return false;
  return (
    schemaVersion === WORKSHEET_HINT_SCHEMA_VERSION ||
    schemaVersion === WORKSHEET_HINT_SCHEMA_VERSION_LEGACY
  );
}

export const WORKSHEET_HINT_AUTHOR_MIN_QUESTIONS = 6;
export const WORKSHEET_HINT_AUTHOR_MAX_QUESTIONS = 12;

export function worksheetQuestionCountEligibleForHintAuthoring(
  questionCount: number,
): boolean {
  return (
    questionCount >= WORKSHEET_HINT_AUTHOR_MIN_QUESTIONS &&
    questionCount <= WORKSHEET_HINT_AUTHOR_MAX_QUESTIONS
  );
}

export function libraryItemEligibleForHintAuthoring(
  contentType: string,
  schemaId: string | null | undefined,
  schemaVersion: number | null | undefined,
): boolean {
  if (contentType !== "worksheet") return false;
  return worksheetSchemaEligible(schemaId, schemaVersion);
}

export function buildWorksheetHintAppendPayload(
  source: Record<string, unknown>,
  hintsByQuestionId: Record<string, string>,
): Record<string, unknown> {
  const next = structuredClone(source);
  const questions = Array.isArray(next.questions) ? next.questions : [];
  next.questions = questions.map((entry) => {
    if (!isRecord(entry)) return entry;
    const id = asTrimmedString(entry.id);
    const clone = { ...entry };
    if (!id) return clone;
    const draft = hintsByQuestionId[id];
    if (typeof draft === "string" && draft.trim()) {
      const validated = validateDraftHintText(draft, {
        answer: entry.answer,
        explanation: entry.explanation,
      });
      if (validated.ok) {
        clone.learner_hint = validated.normalized;
      }
    } else {
      delete clone.learner_hint;
    }
    return clone;
  });
  return next;
}

export function countAppendableHints(
  source: Record<string, unknown>,
  hintsByQuestionId: Record<string, string>,
): number {
  let count = 0;
  const questions = Array.isArray(source.questions) ? source.questions : [];
  for (const entry of questions) {
    if (!isRecord(entry)) continue;
    const id = asTrimmedString(entry.id);
    if (!id) continue;
    const draft = hintsByQuestionId[id];
    if (typeof draft !== "string" || !draft.trim()) continue;
    const validated = validateDraftHintText(draft, {
      answer: entry.answer,
      explanation: entry.explanation,
    });
    if (validated.ok) count += 1;
  }
  return count;
}

export type HintedWorksheetQuestion = {
  questionId: string;
  prompt: string;
  options: string[];
  hintText: string;
};

export function worksheetHintPayloadHasInvalidLearnerHintKey(
  payload: unknown,
): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.questions)) {
    return "Worksheet payload is not valid for hint review.";
  }
  for (const question of payload.questions) {
    if (!isRecord(question)) {
      return "A worksheet question is malformed.";
    }
    if (!("learner_hint" in question)) continue;
    const hintText = normalizeStoredHintText(question.learner_hint);
    if (!hintText) {
      const id = asTrimmedString(question.id) ?? "unknown";
      return `Question ${id} has an invalid learner_hint value.`;
    }
  }
  return null;
}

export function listHintedWorksheetQuestions(
  payload: unknown,
): HintedWorksheetQuestion[] | null {
  if (worksheetHintPayloadHasInvalidLearnerHintKey(payload)) {
    return null;
  }
  if (!isRecord(payload) || !Array.isArray(payload.questions)) {
    return null;
  }
  const items: HintedWorksheetQuestion[] = [];
  for (const question of payload.questions) {
    if (!isRecord(question)) return null;
    const questionId = asTrimmedString(question.id);
    const prompt = asTrimmedString(question.prompt);
    if (!questionId || !prompt) return null;
    if (!("learner_hint" in question)) continue;
    const hintText = normalizeStoredHintText(question.learner_hint);
    if (!hintText) continue;
    const options: string[] = [];
    if (Array.isArray(question.options)) {
      for (const option of question.options) {
        const text = asTrimmedString(option);
        if (text) options.push(text);
      }
    }
    items.push({ questionId, prompt, options, hintText });
  }
  return items;
}

export function worksheetPayloadRequiresHintReview(
  schemaId: string | null | undefined,
  schemaVersion: number | null | undefined,
  payload: unknown,
): boolean {
  if (!worksheetSchemaEligible(schemaId, schemaVersion)) return false;
  if (schemaVersion !== WORKSHEET_HINT_SCHEMA_VERSION) return false;
  if (worksheetHintPayloadHasInvalidLearnerHintKey(payload)) return false;
  const hinted = listHintedWorksheetQuestions(payload);
  return hinted !== null && hinted.length > 0;
}

export type HintReviewPanelMode =
  | { kind: "hidden" }
  | { kind: "invalid"; reason: string }
  | { kind: "review" };

export function resolveHintReviewPanelMode(
  schemaId: string | null | undefined,
  schemaVersion: number | null | undefined,
  payload: unknown,
): HintReviewPanelMode {
  if (!worksheetSchemaEligible(schemaId, schemaVersion)) {
    return { kind: "hidden" };
  }
  if (schemaVersion !== WORKSHEET_HINT_SCHEMA_VERSION) {
    return { kind: "hidden" };
  }
  const invalidReason = worksheetHintPayloadHasInvalidLearnerHintKey(payload);
  if (invalidReason) {
    return { kind: "invalid", reason: invalidReason };
  }
  const hinted = listHintedWorksheetQuestions(payload);
  if (hinted !== null && hinted.length > 0) {
    return { kind: "review" };
  }
  return { kind: "hidden" };
}

export function hintIssueMessage(issue: HintFieldIssue): string {
  switch (issue) {
    case "blank":
      return "Leave blank to omit a hint for this question.";
    case "too_long":
      return "Hints must be 500 Unicode characters or fewer.";
    case "html":
      return "Hints cannot include HTML markup.";
    case "url":
      return "Hints cannot include URLs.";
    case "pii":
      return "Hints cannot include contact details.";
    case "answer_copy":
      return "Hints cannot repeat the answer or explanation.";
    case "grade_language":
      return "Hints cannot include grading or scoring language.";
    default:
      return "This hint is not valid.";
  }
}