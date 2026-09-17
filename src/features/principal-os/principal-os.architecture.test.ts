import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

const PRINCIPAL_FILES = [
  ...walk(path.join(repoRoot, "src/features/principal-os")),
  path.join(repoRoot, "src/services/api/principalSchoolIntelligenceApi.ts"),
].filter(
  (file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"),
);

const FORBIDDEN_IMPORTS = [
  "TeacherAssessmentIntelligenceResponse",
  "TeacherAssessmentIntelligenceLearnerResponse",
  "AssignmentIntelligencePanel",
  "ensureAssignmentEvaluations",
  "recordClassroomAssessment",
  "correctClassroomAssessment",
  "voidClassroomAssessment",
  "createRemediationTeachingWorkFromAssessment",
  "assessmentIntelligenceApi",
  "classroomAssessmentsApi",
  "@/features/teacher-os/assess",
  "@/features/teacher-os/improve",
  "teachingTypes",
];

const FORBIDDEN_LEXEMES = [
  "learner_principal_id",
  "learner_name",
  "teacher_principal_id",
  "teacher_score",
  "teacher_rank",
  "leaderboard",
  "class_result_level",
  "class_result_note",
  "mastery",
  "competency",
  "prediction",
];

describe("AIEOS360-S02-I03 Principal OS architecture", () => {
  it("does not reuse Teacher Assessment Intelligence or mutation APIs", () => {
    const offenders: string[] = [];
    for (const file of PRINCIPAL_FILES) {
      const text = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_IMPORTS) {
        if (text.includes(token)) {
          offenders.push(`${path.relative(repoRoot, file)}:${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps Principal OS privacy and anti-surveillance lexemes out of product code", () => {
    const offenders: string[] = [];
    for (const file of PRINCIPAL_FILES) {
      const text = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_LEXEMES) {
        if (text.toLowerCase().includes(token.toLowerCase())) {
          offenders.push(`${path.relative(repoRoot, file)}:${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not present raw source-authority identifiers or projection enum tokens", () => {
    const presentationFiles = PRINCIPAL_FILES.filter(
      (file) => !file.includes("schoolIntelligence.fixtures.ts"),
    );
    const forbiddenVisible = [
      "SCHOOL_CONTEXT",
      "TEACHING_ASSIGNMENT",
      "TEACHING_EXECUTION",
      "LEARNER_SUBMISSION",
      "LEARNER_ASSESSMENT_EVALUATION",
      "CLASSROOM_ASSESSMENT",
      "TEACHING_WORK_REMEDIATION_ORIGIN",
      "DERIVED_ON_REQUEST",
      "CURRENT_FACTS_AS_OF_REQUEST",
      ".sources.map",
    ];
    const offenders: string[] = [];
    for (const file of presentationFiles) {
      const text = readFileSync(file, "utf8");
      for (const token of forbiddenVisible) {
        if (text.includes(token)) {
          offenders.push(`${path.relative(repoRoot, file)}:${token}`);
        }
      }
    }
    const page = read(
      "src/features/principal-os/school-intelligence/SchoolIntelligencePage.tsx",
    );
    expect(page).toContain("formatProjectionCopy");
    expect(page).toContain("formatTimeBasisCopy");
    expect(page).toContain("GENERIC_SOURCE_PROVENANCE");
    expect(page).not.toContain("{data.projection_mode}");
    expect(page).not.toContain("{data.time_window.mode}");
    expect(offenders).toEqual([]);
  });

  it("Principal API module is the exact School Intelligence GET", () => {
    const api = read("src/services/api/principalSchoolIntelligenceApi.ts");
    expect(api).toContain("/api/v1/principal-os/school-intelligence");
    expect(api).toContain('method: "GET"');
    expect(api.match(/export async function /g)).toEqual([
      "export async function ",
    ]);
    expect(api).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/);
    expect(api).not.toContain("query:");
    expect(api).not.toContain("body:");
  });

  it("router adds Principal OS without changing Teacher or Student defaults", () => {
    const router = read("src/app/router.tsx");
    expect(router).toContain('path="/principal-os"');
    expect(router).toContain("PrincipalOsShell");
    expect(router).toContain("SchoolIntelligencePage");
    expect(router).toContain('path="/" element={<Navigate to="/teacher-os/today" replace />}');
    expect(router).toContain('path="/teacher-os"');
    expect(router).toContain("TeacherOsShell");
    expect(router).toContain('path="/student-os"');
    expect(router).toContain("StudentOsShell");
  });

  it("does not introduce polling, websockets, or persistence", () => {
    const offenders = PRINCIPAL_FILES.filter((file) => {
      const text = readFileSync(file, "utf8");
      return /setInterval|WebSocket|localStorage|sessionStorage|indexedDB/.test(
        text,
      );
    }).map((file) => path.relative(repoRoot, file));
    expect(offenders).toEqual([]);
  });

  it("advances the active consumer snapshot while documenting the I05-F1 pin", () => {
    const sync = read("scripts/sync-openapi-snapshot.mjs");
    expect(sync).toContain("e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b");
    expect(sync).toContain("3d25bb2d7ae3a6a95affdf075a75f20db48a6959");
    const digest = createHash("sha256")
      .update(
        readFileSync(
          path.join(repoRoot, "contracts/openapi/aieos-v1.consumer-snapshot.json"),
        ),
      )
      .digest("hex")
      .toUpperCase();
    expect(digest).toBe(
      "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0",
    );
  });
});
