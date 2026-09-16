import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getPrincipalSchoolIntelligence } from "./principalSchoolIntelligenceApi";
import { mockJsonResponse, stubFetch } from "@/test/test-utils";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function readApi(): string {
  return readFileSync(
    path.join(repoRoot, "src/services/api/principalSchoolIntelligenceApi.ts"),
    "utf8",
  );
}

describe("Principal School Intelligence API adapter", () => {
  it("performs exactly GET /api/v1/principal-os/school-intelligence", async () => {
    const calls = stubFetch(() =>
      mockJsonResponse({
        generated_at: "2026-01-15T12:00:00Z",
        projection_mode: "DERIVED_ON_REQUEST",
        time_window: {
          mode: "CURRENT_FACTS_AS_OF_REQUEST",
          start: null,
          end: "2026-01-15T12:00:00Z",
        },
        evaluation_policy: {
          policy_id: "aieos.learner_assessment.deterministic",
          policy_version: 1,
        },
        sources: [],
        summary: {
          in_scope_class_count: 0,
          classes_with_assignment_activity_count: 0,
          teaching_assignment_count: 0,
          assignment_lifecycle: { active: 0, closed: 0, cancelled: 0 },
          learner_submission_count: 0,
          current_policy_evaluation_count: 0,
          submitted_but_not_current_policy_evaluated_count: 0,
          evaluation_coverage_among_submitted: {
            submitted_count: 0,
            current_policy_evaluated_count: 0,
          },
          classes_with_recorded_classroom_assessment_count: 0,
          assignments_with_recorded_classroom_assessment_count: 0,
          completed_teaching_execution_count: 0,
          remediation_activity_count: 0,
        },
        classes: [],
      }),
    );

    await getPrincipalSchoolIntelligence();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.url).toBe("/api/v1/principal-os/school-intelligence");
    expect(calls[0]?.url).not.toContain("?");
    expect(calls[0]?.body).toBeUndefined();
  });

  it("is a generated-type GET adapter with no mutation surface", () => {
    const api = readApi();
    expect(api).toContain('from "./generated/aieos-v1"');
    expect(api).toContain('components["schemas"]["PrincipalSchoolIntelligenceResponse"]');
    expect(api).toContain('components["schemas"]["PrincipalSchoolIntelligenceSummaryResponse"]');
    expect(api).toContain(
      'components["schemas"]["PrincipalSchoolIntelligenceClassCardResponse"]',
    );
    expect(api).toContain('components["schemas"]["AssignmentLifecycleResponse"]');
    expect(api).toContain(
      'components["schemas"]["EvaluationCoverageAmongSubmittedResponse"]',
    );
    expect(api).toContain('export async function getPrincipalSchoolIntelligence');
    expect(api).toContain('"/api/v1/principal-os/school-intelligence"');
    expect(api).toContain('method: "GET"');
    expect(api).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/);
    expect(api).not.toContain("body:");
    expect(api).not.toContain("query:");
    expect(api).not.toMatch(/class_ref|school_id|teacher_|learner_|capability|role/);
    expect(api).not.toContain("export async function post");
    expect(api).not.toContain("export async function put");
    expect(api).not.toContain("export async function patch");
    expect(api).not.toContain("export async function delete");
  });
});
