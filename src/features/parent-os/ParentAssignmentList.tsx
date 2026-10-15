import type { ParentAssignmentStatusResponse } from "@/services/api/parentIntelligenceApi";
import {
  contentTypeLabel,
  formatAttemptStatus,
  formatAvailableFrom,
  formatDueAt,
  formatSubmittedFact,
} from "./parentPresentation";

export function ParentAssignmentList({
  assignments,
  compact = false,
}: {
  assignments: ParentAssignmentStatusResponse[];
  compact?: boolean;
}) {
  if (assignments.length === 0) {
    return (
      <p className="muted">No current assignments are available for this child.</p>
    );
  }

  const visible = compact ? assignments.slice(0, 3) : assignments;

  return (
    <ul className="parent-os-assignment-list">
      {visible.map((assignment) => {
        const submitted = formatSubmittedFact(
          assignment.attempt_status,
          assignment.submitted_at,
        );
        return (
          <li
            key={assignment.assignment_id}
            className="panel parent-os-assignment-card"
          >
            <header className="parent-os-assignment-header">
              <h3>{assignment.title}</h3>
              <p className="parent-os-assignment-primary">
                <span>{contentTypeLabel(assignment.content_type)}</span>
                <span className="parent-os-status" aria-label="Activity status">
                  {formatAttemptStatus(assignment.attempt_status)}
                </span>
                <span>{formatDueAt(assignment.due_at)}</span>
              </p>
            </header>
            <p className="muted parent-os-assignment-secondary">
              {formatAvailableFrom(assignment.available_from)}
              {submitted ? ` · ${submitted}` : null}
            </p>
          </li>
        );
      })}
      {compact && assignments.length > visible.length ? (
        <li className="muted parent-os-assignment-more">
          {assignments.length - visible.length} more assignment
          {assignments.length - visible.length === 1 ? "" : "s"} on the detail view.
        </li>
      ) : null}
    </ul>
  );
}
