import { describe, expect, it } from "vitest";
import {
  formatCoverageAmongSubmitted,
  formatCurrentFactsAsOf,
  formatProjectionCopy,
  formatTimeBasisCopy,
  GENERIC_SOURCE_PROVENANCE,
  isAuthorizedScopeEmpty,
  schoolSummaryHighlights,
} from "./schoolIntelligencePresentation";
import { emptyAuthorizedScope, sampleSchoolIntelligence } from "../schoolIntelligence.fixtures";

describe("School Intelligence presentation", () => {
  it("formats freshness as school activity as of the backend timestamp", () => {
    expect(formatCurrentFactsAsOf("2026-01-15T12:00:00Z")).toBe(
      "School activity as of 2026-01-15T12:00:00Z",
    );
  });

  it("humanizes projection and time-basis without echoing Backend enum tokens", () => {
    expect(formatProjectionCopy("DERIVED_ON_REQUEST")).toBe("Derived on request");
    expect(formatTimeBasisCopy("CURRENT_FACTS_AS_OF_REQUEST")).toBe(
      "Current facts as of this request",
    );
    expect(GENERIC_SOURCE_PROVENANCE).toBe(
      "Derived from current authorized AIEOS source domains.",
    );
    expect(formatProjectionCopy("DERIVED_ON_REQUEST")).not.toContain(
      "DERIVED_ON_REQUEST",
    );
    expect(formatTimeBasisCopy("CURRENT_FACTS_AS_OF_REQUEST")).not.toContain(
      "CURRENT_FACTS_AS_OF_REQUEST",
    );
  });

  it("renders coverage as submitted counts only, never a percentage or rate", () => {
    const text = formatCoverageAmongSubmitted({
      submitted_count: 10,
      current_policy_evaluated_count: 8,
    });
    expect(text).toBe("8 of 10 submitted work evaluated");
    expect(text).not.toContain("%");
    expect(text.toLowerCase()).not.toContain("rate");
    expect(text).not.toContain("80");
    expect(text.toLowerCase()).not.toContain("current-policy");
  });

  it("prioritizes leadership summary metrics", () => {
    const labels = schoolSummaryHighlights(sampleSchoolIntelligence().summary).map(
      (item) => item.label,
    );
    expect(labels).toEqual([
      "Classes in scope",
      "Classes with assignment activity",
      "Learner submissions",
      "Evaluation coverage (submitted work)",
      "Classes with recorded classroom assessment",
      "Remediation activity",
    ]);
  });

  it("treats zero authorized classes as an empty authorized scope", () => {
    expect(isAuthorizedScopeEmpty(emptyAuthorizedScope())).toBe(true);
    expect(isAuthorizedScopeEmpty(sampleSchoolIntelligence())).toBe(false);
  });
});
