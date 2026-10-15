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

export function parentChildDetailPath(learnerPrincipalId: string): string {
  return `/parent-os/children/${encodeURIComponent(learnerPrincipalId)}`;
}

export function formatTimeBasisCopy(): string {
  return "Updates reflect authorized assignments as of this visit.";
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
  const formatted = formatParentInstant(generatedAt, now);
  return formatted
    ? `Family view updated ${formatted}`
    : `Family view updated ${generatedAt}`;
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
  return formatted ? `Due ${formatted}` : "No due date";
}

export function formatAvailableFrom(
  availableFrom: string,
  now: Date = new Date(),
): string {
  const formatted = formatParentInstant(availableFrom, now);
  return formatted ? `Available from ${formatted}` : `Available from ${availableFrom}`;
}

export function formatSubmittedFact(
  status: string,
  submittedAt: string | null,
  now: Date = new Date(),
): string | null {
  if (status !== ATTEMPT_STATUS_SUBMITTED) return null;
  const formatted = formatParentInstant(submittedAt, now);
  return formatted ? `Submitted ${formatted}` : "Submitted";
}

export function contentTypeLabel(contentType: string): string {
  const normalized = contentType.trim().toLowerCase();
  if (normalized === "worksheet") return "Worksheet";
  if (normalized === "quiz") return "Quiz";
  if (normalized === "homework") return "Homework";
  const trimmed = contentType.trim();
  if (!trimmed) return contentType;
  return trimmed.replaceAll("_", " ").replaceAll(".", " ");
}

export type ParentAssignmentStatusSummary = {
  total: number;
  notStarted: number;
  inProgress: number;
  submitted: number;
};

export function summarizeAssignmentStatuses(
  assignments: ParentAssignmentStatusResponse[],
): ParentAssignmentStatusSummary {
  const summary: ParentAssignmentStatusSummary = {
    total: assignments.length,
    notStarted: 0,
    inProgress: 0,
    submitted: 0,
  };
  for (const assignment of assignments) {
    if (assignment.attempt_status === ATTEMPT_STATUS_SUBMITTED) {
      summary.submitted += 1;
    } else if (assignment.attempt_status === ATTEMPT_STATUS_IN_PROGRESS) {
      summary.inProgress += 1;
    } else {
      summary.notStarted += 1;
    }
  }
  return summary;
}

export function formatAssignmentStatusSummary(
  summary: ParentAssignmentStatusSummary,
): string {
  if (summary.total === 0) {
    return "No current assignments";
  }
  const parts: string[] = [`${summary.total} current assignment${summary.total === 1 ? "" : "s"}`];
  if (summary.inProgress > 0) {
    parts.push(`${summary.inProgress} in progress`);
  }
  if (summary.submitted > 0) {
    parts.push(`${summary.submitted} submitted`);
  }
  if (summary.notStarted > 0) {
    parts.push(`${summary.notStarted} not started`);
  }
  return parts.join(" · ");
}

export function authorizedChildrenLead(count: number): string {
  if (count === 0) return "No authorized children in your family view right now.";
  if (count === 1) return "One child is available in your family view.";
  return `${count} children are available in your family view.`;
}
