import { describe, expect, it } from "vitest";
import { formatLessonDate, formatSubmittedAt, formatSubmittedDay } from "./teacherDates";

describe("teacherDates", () => {
  it("formats a lesson calendar date without inventing time", () => {
    expect(formatLessonDate("2026-09-07")).toBe("7 Sep 2026");
    expect(formatLessonDate("not-a-date")).toBe("not-a-date");
  });

  it("formats submitted times relative to today", () => {
    const now = new Date(2026, 8, 7, 12, 0, 0);
    expect(formatSubmittedAt("2026-09-07T10:30:00", now)).toMatch(/today at /);
    expect(formatSubmittedDay("2026-08-20T10:00:00Z")).toMatch(/2026/);
  });
});
