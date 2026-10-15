import type { StudentAssignmentResponse } from "@/services/api/studentLearningApi";
import { AssignmentCard } from "./AssignmentCard";
import { useEnrichedAssignmentForCard } from "./assignmentCardEnrichment";

/** Home/list card: enriches title/type from assignment detail when list omits `resource`. */
export function AssignmentCardFromList({
  assignment,
  actionLabel,
}: {
  assignment: StudentAssignmentResponse;
  actionLabel?: string;
}) {
  const displayed = useEnrichedAssignmentForCard(assignment);
  return <AssignmentCard assignment={displayed} actionLabel={actionLabel} />;
}
