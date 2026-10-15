import { ShowcaseLink } from "@/features/aieos360-showcase/ShowcaseContinuity";
import { StatusBadge } from "@/shared/components/StatusBadge";
import type { StudentAssignmentResponse } from "@/services/api/studentLearningApi";
import {
  assignmentAvailabilityLabel,
  assignmentPrimaryActionLabel,
  assignmentTitle,
  assignmentTimingSummary,
  attemptProgressLabel,
  contentTypeLabel,
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
  const timing = assignmentTimingSummary(assignment);
  const href =
    assignment.attempt_summary === "IN_PROGRESS" && assignment.attempt_id
      ? `/student-os/attempts/${assignment.attempt_id}`
      : assignment.attempt_summary === "SUBMITTED" && assignment.attempt_id
        ? `/student-os/attempts/${assignment.attempt_id}`
        : `/student-os/assignments/${assignment.assignment_id}`;
  const cta =
    actionLabel ?? assignmentPrimaryActionLabel(assignment.attempt_summary);

  return (
    <li className="panel sos-item sos-card">
      <div className="sos-card-body">
        <div className="sos-card-heading">
          <h2 className="sos-card-title">{title}</h2>
          <p className="sos-card-type">{typeLabel}</p>
        </div>
        <p className="sos-card-timing">{timing}</p>
        <div className="sos-card-badges" aria-label="Assignment status">
          <StatusBadge label={progress} kind={assignment.attempt_summary} />
          <StatusBadge label={availability} />
        </div>
      </div>
      <div className="sos-actions sos-card-actions">
        <ShowcaseLink
          className="btn"
          to={href}
          aria-label={`${cta}: ${title}`}
        >
          {cta}
        </ShowcaseLink>
      </div>
    </li>
  );
}
