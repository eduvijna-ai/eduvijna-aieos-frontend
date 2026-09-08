import { Link } from "react-router-dom";
import { StatusBadge } from "@/shared/components/StatusBadge";
import type { StudentAssignmentResponse } from "@/services/api/studentLearningApi";
import {
  assignmentAvailabilityLabel,
  assignmentTitle,
  attemptProgressLabel,
  availableFromLabel,
  contentTypeLabel,
  dueLabel,
} from "../assignmentPresentation";

export function AssignmentCard({
  assignment,
  actionLabel,
}: {
  assignment: StudentAssignmentResponse;
  actionLabel?: string;
}) {
  const title = assignmentTitle(assignment);
  const typeLabel = contentTypeLabel(
    assignment.resource?.content_type ?? "Assigned work",
  );
  const progress = attemptProgressLabel(assignment.attempt_summary);
  const availability = assignmentAvailabilityLabel(assignment);
  const href =
    assignment.attempt_summary === "IN_PROGRESS" && assignment.attempt_id
      ? `/student-os/attempts/${assignment.attempt_id}`
      : assignment.attempt_summary === "SUBMITTED" && assignment.attempt_id
        ? `/student-os/attempts/${assignment.attempt_id}`
        : `/student-os/assignments/${assignment.assignment_id}`;
  const label =
    actionLabel ??
    (assignment.attempt_summary === "IN_PROGRESS"
      ? `Continue ${title}`
      : assignment.attempt_summary === "SUBMITTED"
        ? `Review ${title}`
        : `Open ${title}`);

  return (
    <li className="panel sos-item">
      <div>
        <h2>{title}</h2>
        <p className="muted">{typeLabel}</p>
        <dl className="sos-meta">
          <div>
            <dt>Progress</dt>
            <dd>
              <StatusBadge label={progress} kind={assignment.attempt_summary} />
            </dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>
              <StatusBadge label={availability} />
            </dd>
          </div>
          <div>
            <dt>Timing</dt>
            <dd>
              {availableFromLabel(assignment)}
              <br />
              {dueLabel(assignment)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="sos-actions">
        <Link className="btn" to={href}>
          {label}
        </Link>
      </div>
    </li>
  );
}
