import { describe, expect, it } from "vitest";
import {
  readRoleUrlOverrides,
  resolveRoleLaunchUrls,
  resolveStoryStageUrl,
  resolveTeacherOsStageUrl,
  STORY_STAGE_ORDER,
} from "./roleUrls";

const host = { protocol: "http:", hostname: "demo.local" };

describe("AIEOS360 showcase role URLs", () => {
  it("builds default local role launch URLs on the current hostname", () => {
    const urls = resolveRoleLaunchUrls(host, {});
    expect(urls.teacher).toBe(
      "http://demo.local:5291/teacher-os/today",
    );
    expect(urls.student).toBe(
      "http://demo.local:5292/student-os/home",
    );
    expect(urls.principal).toBe("http://demo.local:5293/principal-os");
    expect(urls.parent).toBe("http://demo.local:5294/parent-os");
  });

  it("honors explicit Vite role URL overrides when provided", () => {
    const overrides = readRoleUrlOverrides({
      VITE_AIEOS360_SHOWCASE_TEACHER_URL: "https://teacher.example/today",
      VITE_AIEOS360_SHOWCASE_STUDENT_URL: "https://student.example/home",
      VITE_AIEOS360_SHOWCASE_PRINCIPAL_URL: "https://principal.example/",
      VITE_AIEOS360_SHOWCASE_PARENT_URL: "https://parent.example/",
    });
    const urls = resolveRoleLaunchUrls(host, overrides);
    expect(urls.teacher).toBe("https://teacher.example/today");
    expect(urls.student).toBe("https://student.example/home");
    expect(urls.principal).toBe("https://principal.example/");
    expect(urls.parent).toBe("https://parent.example/");
  });

  it("maps teacher assessment and improve stages from teacher override origin", () => {
    const overrides = {
      teacher: "https://teacher.example/teacher-os/today",
    };
    const roleUrls = resolveRoleLaunchUrls(host, overrides);
    expect(
      resolveStoryStageUrl("assessment", host, roleUrls, overrides),
    ).toBe("https://teacher.example/teacher-os/assess");
    expect(resolveStoryStageUrl("improve", host, roleUrls, overrides)).toBe(
      "https://teacher.example/teacher-os/improve",
    );
  });

  it("keeps the governed six-stage story order", () => {
    expect(STORY_STAGE_ORDER.map((stage) => stage.label)).toEqual([
      "Teacher",
      "Student",
      "Assessment",
      "Improve",
      "Principal",
      "Parent",
    ]);
  });

  it("uses teacher rehearsal port for assess and improve without override", () => {
    expect(
      resolveTeacherOsStageUrl(host, "/teacher-os/assess"),
    ).toBe("http://demo.local:5291/teacher-os/assess");
    expect(
      resolveTeacherOsStageUrl(host, "/teacher-os/improve"),
    ).toBe("http://demo.local:5291/teacher-os/improve");
  });
});
