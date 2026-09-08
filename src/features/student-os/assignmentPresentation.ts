import type { StudentAssignmentResponse } from "@/services/api/studentLearningApi";
import { formatSubmittedAt } from "@/shared/time/teacherDates";

export const ATTEMPT_SUMMARY_NOT_STARTED = "NOT_STARTED";
export const ATTEMPT_SUMMARY_IN_PROGRESS = "IN_PROGRESS";
export const ATTEMPT_SUMMARY_SUBMITTED = "SUBMITTED";

export function assignmentTitle(
  assignment: StudentAssignmentResponse,
): string {
  return assignment.resource?.title?.trim() || "Assigned work";
}

export function contentTypeLabel(contentType: string): string {
  const normalized = contentType.trim().toLowerCase();
  if (normalized === "worksheet") return "Worksheet";
  if (normalized === "quiz") return "Quiz";
  if (normalized === "homework") return "Homework";
  return contentType.replaceAll("_", " ").replaceAll(".", " ");
}

export function attemptProgressLabel(summary: string): string {
  if (summary === ATTEMPT_SUMMARY_IN_PROGRESS) return "In progress";
  if (summary === ATTEMPT_SUMMARY_SUBMITTED) return "Submitted";
  return "Not started";
}

export function assignmentAvailabilityLabel(
  assignment: StudentAssignmentResponse,
): string {
  if (assignment.lifecycle_state === "CANCELLED") return "Cancelled";
  if (assignment.lifecycle_state === "CLOSED") return "Closed";
  if (!assignment.currently_consumable) return "Not available yet";
  return "Available";
}

export function formatStudentInstant(value: string | null): string | null {
  if (!value) return null;
  return formatSubmittedAt(value);
}

export function dueLabel(assignment: StudentAssignmentResponse): string {
  const formatted = formatStudentInstant(assignment.due_at);
  return formatted ? `Due ${formatted}` : "No due date";
}

export function availableFromLabel(
  assignment: StudentAssignmentResponse,
): string {
  const formatted = formatStudentInstant(assignment.available_from);
  return formatted ? `Available from ${formatted}` : "Availability not provided";
}

export function questionKindLabel(questionType: string): string {
  if (questionType === "MULTIPLE_CHOICE") return "Choose one answer";
  if (questionType === "SHORT_ANSWER") return "Write your answer";
  if (questionType === "TRUE_FALSE") return "True or false";
  return "Answer";
}
