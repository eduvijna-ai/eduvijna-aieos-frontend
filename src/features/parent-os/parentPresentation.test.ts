import { describe, expect, it } from "vitest";
import {
  childOrdinalLabel,
  formatAttemptStatus,
  formatDueAt,
  formatSubmittedFact,
  formatTimeBasisCopy,
} from "./parentPresentation";

describe("Parent OS presentation", () => {
  it("maps only the Parent attempt vocabulary", () => {
    expect(formatAttemptStatus("NOT_STARTED")).toBe("Not started");
    expect(formatAttemptStatus("IN_PROGRESS")).toBe("In progress");
    expect(formatAttemptStatus("SUBMITTED")).toBe("Submitted");
  });

  it("renders a missing due date honestly", () => {
    expect(formatDueAt(null)).toBe("No due date");
  });

  it("does not invent a submitted time for non-submitted work", () => {
    expect(formatSubmittedFact("NOT_STARTED", null)).toBe("Not submitted");
    expect(formatSubmittedFact("IN_PROGRESS", "2026-09-17T09:30:00Z")).toBe(
      "Not submitted",
    );
  });

  it("uses ephemeral child order labels", () => {
    expect(childOrdinalLabel(0)).toBe("Child 1");
    expect(childOrdinalLabel(1)).toBe("Child 2");
  });

  it("uses a current-facts basis without raw enum tokens", () => {
    expect(formatTimeBasisCopy()).toBe("Current facts as of this request");
    expect(formatTimeBasisCopy()).not.toContain("CURRENT_FACTS_AS_OF_REQUEST");
  });
});
