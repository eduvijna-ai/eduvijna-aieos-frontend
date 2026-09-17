import type {
  ParentAssignmentStatusResponse,
  ParentChildCardResponse,
  ParentIntelligenceResponse,
} from "@/services/api/parentIntelligenceApi";
import { formatSubmittedAt } from "@/shared/time/teacherDates";

export const ATTEMPT_STATUS_NOT_STARTED = "NOT_STARTED";
export const ATTEMPT_STATUS_IN_PROGRESS = "IN_PROGRESS";
export const ATTEMPT_STATUS_SUBMITTED = "SUBMITTED";

export function childrenOf(
  data: ParentIntelligenceResponse,
): ParentChildCardResponse[] {
  return data.children ?? [];
}

export function assignmentsOf(
  child: ParentChildCardResponse,
): ParentAssignmentStatusResponse[] {
  return child.assignments ?? [];
}

export function childOrdinalLabel(index: number): string {
  return `Child ${index + 1}`;
}

export function formatTimeBasisCopy(): string {
  return "Current facts as of this request";
}

export function formatParentInstant(
  value: string | null,
  now: Date = new Date(),
): string | null {
  if (!value) return null;
  return formatSubmittedAt(value, now);
}

export function formatCurrentFactsAsOf(
  generatedAt: string,
  now: Date = new Date(),
): string {
  return formatParentInstant(generatedAt, now) ?? generatedAt;
}

export function formatAttemptStatus(status: string): string {
  if (status === ATTEMPT_STATUS_IN_PROGRESS) return "In progress";
  if (status === ATTEMPT_STATUS_SUBMITTED) return "Submitted";
  if (status === ATTEMPT_STATUS_NOT_STARTED) return "Not started";
  return status;
}

export function formatDueAt(
  dueAt: string | null,
  now: Date = new Date(),
): string {
  const formatted = formatParentInstant(dueAt, now);
  return formatted ?? "No due date";
}

export function formatAvailableFrom(
  availableFrom: string,
  now: Date = new Date(),
): string {
  const formatted = formatParentInstant(availableFrom, now);
  return formatted ?? availableFrom;
}

export function formatSubmittedFact(
  status: string,
  submittedAt: string | null,
  now: Date = new Date(),
): string {
  if (status !== ATTEMPT_STATUS_SUBMITTED) return "Not submitted";
  const formatted = formatParentInstant(submittedAt, now);
  return formatted ?? "Submitted";
}

export function contentTypeLabel(contentType: string): string {
  const trimmed = contentType.trim();
  if (!trimmed) return contentType;
  return trimmed.replaceAll("_", " ").replaceAll(".", " ");
}
