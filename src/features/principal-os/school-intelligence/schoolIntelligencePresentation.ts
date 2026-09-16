import type {
  EvaluationCoverageAmongSubmittedResponse,
  PrincipalSchoolIntelligenceResponse,
} from "@/services/api/principalSchoolIntelligenceApi";

export function formatCurrentFactsAsOf(generatedAt: string): string {
  return `Current facts as of ${generatedAt}`;
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
