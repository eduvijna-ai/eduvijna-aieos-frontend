import { describe, expect, it } from "vitest";
import {
  formatCoverageAmongSubmitted,
  formatCurrentFactsAsOf,
  isAuthorizedScopeEmpty,
} from "./schoolIntelligencePresentation";
import { emptyAuthorizedScope, sampleSchoolIntelligence } from "../schoolIntelligence.fixtures";

describe("School Intelligence presentation", () => {
  it("formats freshness as current facts as of the backend timestamp", () => {
    expect(formatCurrentFactsAsOf("2026-01-15T12:00:00Z")).toBe(
      "Current facts as of 2026-01-15T12:00:00Z",
    );
  });

  it("renders coverage as submitted counts only, never a percentage or rate", () => {
    const text = formatCoverageAmongSubmitted({
      submitted_count: 10,
      current_policy_evaluated_count: 8,
    });
    expect(text).toBe(
      "Current-policy evaluations: 8 of 10 submitted evidence records",
    );
    expect(text).not.toContain("%");
    expect(text.toLowerCase()).not.toContain("rate");
    expect(text).not.toContain("80");
  });

  it("treats zero authorized classes as an empty authorized scope", () => {
    expect(isAuthorizedScopeEmpty(emptyAuthorizedScope())).toBe(true);
    expect(isAuthorizedScopeEmpty(sampleSchoolIntelligence())).toBe(false);
  });
});
