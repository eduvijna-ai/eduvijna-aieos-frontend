import type { DevSession } from "@/services/session/DevSessionConnector";

export type VerifiedLearnerHintOutcome =
  | { kind: "hint"; text: string }
  | { kind: "empty" }
  | { kind: "mismatch" }
  | { kind: "invalid" };

const HINT_TEXT_MIN_LEN = 1;
const HINT_TEXT_MAX_LEN = 500;

function normalizeHintText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length < HINT_TEXT_MIN_LEN || trimmed.length > HINT_TEXT_MAX_LEN) {
    return null;
  }
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Privacy-boundary key for dev sessions — never log or render; excludes raw bearer.
 */
export function devSessionPrivacyBoundaryKey(
  session: DevSession | null,
): string | null {
  if (!session) {
    return null;
  }
  let fingerprint = 5381;
  for (let i = 0; i < session.bearerToken.length; i++) {
    fingerprint =
      ((fingerprint << 5) + fingerprint) ^ session.bearerToken.charCodeAt(i);
  }
  return `${session.tenantId}\u0001${session.apiOrigin}\u0001${fingerprint}`;
}

export function verifyLearnerHintForQuestion(
  body: unknown,
  context: {
    attemptId: string;
    contentVersionId: string;
    questionId: string;
    questionIds: readonly string[];
  },
): VerifiedLearnerHintOutcome {
  if (!isRecord(body)) {
    return { kind: "invalid" };
  }
  if (typeof body.attempt_id !== "string" || body.attempt_id.length === 0) {
    return { kind: "invalid" };
  }
  if (
    typeof body.content_version_id !== "string" ||
    body.content_version_id.length === 0
  ) {
    return { kind: "invalid" };
  }
  if (!Array.isArray(body.hints)) {
    return { kind: "invalid" };
  }

  const seenQuestionIds = new Set<string>();
  for (const entry of body.hints) {
    if (!isRecord(entry)) {
      return { kind: "invalid" };
    }
    if (typeof entry.question_id !== "string" || entry.question_id.length === 0) {
      return { kind: "invalid" };
    }
    if (seenQuestionIds.has(entry.question_id)) {
      return { kind: "invalid" };
    }
    seenQuestionIds.add(entry.question_id);
    if (!context.questionIds.includes(entry.question_id)) {
      return { kind: "invalid" };
    }
    if (!("hint_text" in entry)) {
      return { kind: "invalid" };
    }
    const normalized = normalizeHintText(entry.hint_text);
    if (normalized === null) {
      return { kind: "invalid" };
    }
  }

  if (body.attempt_id !== context.attemptId) {
    return { kind: "mismatch" };
  }
  if (body.content_version_id !== context.contentVersionId) {
    return { kind: "mismatch" };
  }
  if (!context.questionIds.includes(context.questionId)) {
    return { kind: "mismatch" };
  }

  const item = body.hints.find(
    (hint) => isRecord(hint) && hint.question_id === context.questionId,
  );
  if (!item || !isRecord(item)) {
    return { kind: "empty" };
  }
  const text = normalizeHintText(item.hint_text);
  if (!text) {
    return { kind: "empty" };
  }
  return { kind: "hint", text };
}