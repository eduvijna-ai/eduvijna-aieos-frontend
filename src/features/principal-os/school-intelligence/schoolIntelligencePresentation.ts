import type {
  EvaluationCoverageAmongSubmittedResponse,
  PrincipalSchoolIntelligenceResponse,
} from "@/services/api/principalSchoolIntelligenceApi";

export function formatCurrentFactsAsOf(generatedAt: string): string {
  return `Current facts as of ${generatedAt}`;
}

export function formatCoverageAmongSubmitted(
  coverage: EvaluationCoverageAmongSubmittedResponse,
): string {
  return `Current-policy evaluations: ${coverage.current_policy_evaluated_count} of ${coverage.submitted_count} submitted evidence records`;
}

export function formatActivityPresence(value: boolean): string {
  return value ? "Yes" : "No";
}

export function isAuthorizedScopeEmpty(
  data: PrincipalSchoolIntelligenceResponse,
): boolean {
  return data.summary.in_scope_class_count === 0 && data.classes.length === 0;
}
