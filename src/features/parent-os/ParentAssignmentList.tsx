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
}: {
  assignments: ParentAssignmentStatusResponse[];
}) {
  if (assignments.length === 0) {
    return (
      <p className="muted">No current assignments are available for this child.</p>
    );
  }

  return (
    <ul className="parent-os-assignment-list">
      {assignments.map((assignment) => (
        <li
          key={assignment.assignment_id}
          className="panel parent-os-assignment-card"
        >
          <h3>{assignment.title}</h3>
          <dl className="parent-os-facts">
            <div>
              <dt>Type</dt>
              <dd>{contentTypeLabel(assignment.content_type)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className="parent-os-status">
                {formatAttemptStatus(assignment.attempt_status)}
              </dd>
            </div>
            <div>
              <dt>Available from</dt>
              <dd>{formatAvailableFrom(assignment.available_from)}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{formatDueAt(assignment.due_at)}</dd>
            </div>
            <div>
              <dt>Submitted at</dt>
              <dd>
                {formatSubmittedFact(
                  assignment.attempt_status,
                  assignment.submitted_at,
                )}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
