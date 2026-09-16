import { describe, expect, it } from "vitest";
import {
  formatCoverageAmongSubmitted,
  formatCurrentFactsAsOf,
  formatProjectionCopy,
  formatTimeBasisCopy,
  GENERIC_SOURCE_PROVENANCE,
  isAuthorizedScopeEmpty,
} from "./schoolIntelligencePresentation";
import { emptyAuthorizedScope, sampleSchoolIntelligence } from "../schoolIntelligence.fixtures";

describe("School Intelligence presentation", () => {
  it("formats freshness as current facts as of the backend timestamp", () => {
    expect(formatCurrentFactsAsOf("2026-01-15T12:00:00Z")).toBe(
      "Current facts as of 2026-01-15T12:00:00Z",
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
