import { describe, expect, it } from "vitest";
import {
  assignedVersionExplanation,
  assignmentPrimaryActionLabel,
  assignmentTimingSummary,
} from "./assignmentPresentation";
import { sampleAssignment } from "./studentOs.fixtures";

describe("assignment presentation helpers", () => {
  it("maps attempt summary to primary CTAs", () => {
    expect(assignmentPrimaryActionLabel("NOT_STARTED")).toBe("Start");
    expect(assignmentPrimaryActionLabel("IN_PROGRESS")).toBe("Continue");
    expect(assignmentPrimaryActionLabel("SUBMITTED")).toBe(
      "Review submitted work",
    );
  });

  it("explains assigned version in student-friendly language", () => {
    expect(assignedVersionExplanation()).toMatch(/teacher assigned/i);
    expect(assignedVersionExplanation()).not.toMatch(/publication|version id/i);
  });

  it("prefers due date in card timing summary", () => {
    const withDue = sampleAssignment({
      due_at: "2026-09-10T15:00:00Z",
    });
    expect(assignmentTimingSummary(withDue)).toMatch(/^Due /);
  });
});
