import type {
  EvaluationCoverageAmongSubmittedResponse,
  PrincipalSchoolIntelligenceClassCardResponse,
  PrincipalSchoolIntelligenceResponse,
  PrincipalSchoolIntelligenceSummaryResponse,
} from "@/services/api/principalSchoolIntelligenceApi";

export function formatCurrentFactsAsOf(generatedAt: string): string {
  return `School activity as of ${generatedAt}`;
}

export function formatProjectionCopy(mode: string): string {
  void mode;
  return "Derived on request";
}

export function formatTimeBasisCopy(mode: string): string {
  void mode;
  return "Current facts as of this request";
}

export const GENERIC_SOURCE_PROVENANCE =
  "Derived from current authorized AIEOS source domains.";

export function formatCoverageAmongSubmitted(
  coverage: EvaluationCoverageAmongSubmittedResponse,
): string {
  if (coverage.submitted_count === 0) {
    return "No submitted work to evaluate yet";
  }
  return `${coverage.current_policy_evaluated_count} of ${coverage.submitted_count} submitted work evaluated`;
}

export function formatEvaluationCoverageDetail(
  coverage: EvaluationCoverageAmongSubmittedResponse,
): string {
  if (coverage.submitted_count === 0) {
    return "Evaluation coverage applies only after learners submit work.";
  }
  const pending =
    coverage.submitted_count - coverage.current_policy_evaluated_count;
  if (pending <= 0) {
    return "All submitted work in scope has been evaluated under the current evaluation policy.";
  }
  return `${pending} submitted record${pending === 1 ? "" : "s"} still awaiting evaluation under the current policy.`;
}

export function formatActivityPresence(value: boolean): string {
  return value ? "Activity recorded" : "No activity yet";
}

export function isAuthorizedScopeEmpty(
  data: PrincipalSchoolIntelligenceResponse,
): boolean {
  return data.summary.in_scope_class_count === 0 && data.classes.length === 0;
}

export type SchoolSummaryHighlight = {
  label: string;
  value: string | number;
  detail?: string;
};

export function schoolSummaryHighlights(
  summary: PrincipalSchoolIntelligenceSummaryResponse,
): SchoolSummaryHighlight[] {
  return [
    {
      label: "Classes in scope",
      value: summary.in_scope_class_count,
    },
    {
      label: "Classes with assignment activity",
      value: summary.classes_with_assignment_activity_count,
    },
    {
      label: "Learner submissions",
      value: summary.learner_submission_count,
    },
    {
      label: "Evaluation coverage (submitted work)",
      value: formatCoverageAmongSubmitted(summary.evaluation_coverage_among_submitted),
      detail: formatEvaluationCoverageDetail(
        summary.evaluation_coverage_among_submitted,
      ),
    },
    {
      label: "Classes with recorded classroom assessment",
      value: summary.classes_with_recorded_classroom_assessment_count,
    },
    {
      label: "Remediation activity",
      value: summary.remediation_activity_count,
    },
  ];
}

export type ClassActivityHighlight = {
  label: string;
  value: string | number;
};

export function classActivityHighlights(
  item: PrincipalSchoolIntelligenceClassCardResponse,
): ClassActivityHighlight[] {
  return [
    {
      label: "Assignment activity",
      value: formatActivityPresence(item.has_assignment_activity),
    },
    {
      label: "Active assignments",
      value: item.assignment_lifecycle.active,
    },
    {
      label: "Learner submissions",
      value: item.learner_submission_count,
    },
    {
      label: "Evaluation coverage",
      value: formatCoverageAmongSubmitted(item.evaluation_coverage_among_submitted),
    },
    {
      label: "Recorded classroom assessment",
      value: formatActivityPresence(item.has_recorded_classroom_assessment),
    },
    {
      label: "Remediation activity",
      value: item.remediation_activity_count,
    },
  ];
}
