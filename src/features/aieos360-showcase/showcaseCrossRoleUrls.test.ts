import { describe, expect, it } from "vitest";
import {
  buildParentShowcaseUrl,
  buildPrincipalShowcaseUrl,
  buildStudentAssignmentShowcaseUrl,
  buildTeacherAssessShowcaseUrl,
} from "./showcaseCrossRoleUrls";

const host = { protocol: "http:", hostname: "demo.local" };

describe("showcase cross-role URLs", () => {
  it("builds student assignment URLs on the student rehearsal port", () => {
    expect(
      buildStudentAssignmentShowcaseUrl("assign-123", host, {}),
    ).toBe(
      "http://demo.local:5292/student-os/assignments/assign-123?showcase=1",
    );
  });

  it("builds teacher assess URLs with real assignment_id", () => {
    expect(buildTeacherAssessShowcaseUrl("assign-123", host, {})).toBe(
      "http://demo.local:5291/teacher-os/assess?assignment_id=assign-123&showcase=1",
    );
  });

  it("honors role URL overrides for cross-role handoffs", () => {
    const overrides = {
      student: "https://student.example/student-os/home",
      teacher: "https://teacher.example/teacher-os/today",
      principal: "https://principal.example/principal-os",
      parent: "https://parent.example/parent-os",
    };
    expect(
      buildStudentAssignmentShowcaseUrl("a1", host, overrides),
    ).toBe("https://student.example/student-os/assignments/a1?showcase=1");
    expect(buildTeacherAssessShowcaseUrl("a1", host, overrides)).toBe(
      "https://teacher.example/teacher-os/assess?assignment_id=a1&showcase=1",
    );
    expect(buildPrincipalShowcaseUrl(host, overrides)).toBe(
      "https://principal.example/principal-os?showcase=1",
    );
    expect(buildParentShowcaseUrl(host, overrides)).toBe(
      "https://parent.example/parent-os?showcase=1",
    );
  });
});
