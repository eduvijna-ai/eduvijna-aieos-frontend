import { describe, expect, it } from "vitest";
import {
  childOrdinalLabel,
  formatAssignmentStatusSummary,
  formatAttemptStatus,
  formatDueAt,
  formatSubmittedFact,
  formatTimeBasisCopy,
  summarizeAssignmentStatuses,
} from "./parentPresentation";
import type { ParentAssignmentStatusResponse } from "@/services/api/parentIntelligenceApi";

function assignment(
  status: string,
): ParentAssignmentStatusResponse {
  return {
    assignment_id: "a1",
    title: "Sample",
    content_type: "worksheet",
    available_from: "2026-09-18T08:00:00.000Z",
    due_at: null,
    attempt_status: status,
    submitted_at: null,
  };
}

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
    expect(formatSubmittedFact("NOT_STARTED", null)).toBeNull();
    expect(formatSubmittedFact("IN_PROGRESS", "2026-09-17T09:30:00Z")).toBeNull();
  });

  it("uses ephemeral child order labels", () => {
    expect(childOrdinalLabel(0)).toBe("Child 1");
    expect(childOrdinalLabel(1)).toBe("Child 2");
  });

  it("summarizes assignment statuses from returned facts only", () => {
    const summary = summarizeAssignmentStatuses([
      assignment("NOT_STARTED"),
      assignment("IN_PROGRESS"),
      assignment("SUBMITTED"),
    ]);
    expect(summary).toEqual({
      total: 3,
      notStarted: 1,
      inProgress: 1,
      submitted: 1,
    });
    expect(formatAssignmentStatusSummary(summary)).toBe(
      "3 current assignments · 1 in progress · 1 submitted · 1 not started",
    );
  });

  it("uses a calm time-basis line without raw enum tokens", () => {
    expect(formatTimeBasisCopy()).toBe(
      "Updates reflect authorized assignments as of this visit.",
    );
    expect(formatTimeBasisCopy()).not.toContain("CURRENT_FACTS_AS_OF_REQUEST");
  });
});
