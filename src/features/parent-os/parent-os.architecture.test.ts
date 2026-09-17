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

const PARENT_FILES = [
  ...walk(path.join(repoRoot, "src/features/parent-os")),
  path.join(repoRoot, "src/services/api/parentIntelligenceApi.ts"),
].filter(
  (file) =>
    !file.endsWith(".test.ts") &&
    !file.endsWith(".test.tsx") &&
    !file.endsWith(".fixtures.ts"),
);

const FORBIDDEN_IMPORTS = [
  "PrincipalSchoolIntelligenceResponse",
  "TeacherAssessmentIntelligenceResponse",
  "TeacherAssessmentIntelligenceLearnerResponse",
  "AssignmentIntelligencePanel",
  "ensureAssignmentEvaluations",
  "recordClassroomAssessment",
  "assessmentIntelligenceApi",
  "principalSchoolIntelligenceApi",
  "@/features/teacher-os/assess",
  "@/features/teacher-os/improve",
  "@/features/principal-os/school-intelligence",
];

const FORBIDDEN_LEXEMES = [
  "mastery",
  "competency",
  "prediction",
  "leaderboard",
  "behind peers",
  "class_ref",
  "content_id",
  "content_version_id",
  "attempt_id",
  "submission_id",
  "evaluation_id",
  "teacher_principal_id",
  "setInterval",
  "WebSocket",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "openai",
  "Parent Agent",
];

describe("AIEOS360-S03-I03 Parent OS architecture", () => {
  it("does not reuse Principal or Teacher Intelligence surfaces", () => {
    const offenders: string[] = [];
    for (const file of PARENT_FILES) {
      const text = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_IMPORTS) {
        if (text.includes(token)) {
          offenders.push(`${path.relative(repoRoot, file)}:${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps forbidden Parent vocabulary out of product source", () => {
    const offenders: string[] = [];
    for (const file of PARENT_FILES) {
      const text = readFileSync(file, "utf8").toLowerCase();
      for (const token of FORBIDDEN_LEXEMES) {
        if (text.includes(token.toLowerCase())) {
          offenders.push(`${path.relative(repoRoot, file)}:${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Parent API module is GET-only home and child selector", () => {
    const api = read("src/services/api/parentIntelligenceApi.ts");
    expect(api).toContain("/api/v1/parent-os/home");
    expect(api).toContain("/api/v1/parent-os/children/");
    expect(api).toContain('method: "GET"');
    expect(api.match(/export async function /g)).toEqual([
      "export async function ",
      "export async function ",
    ]);
    expect(api).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/);
    expect(api).not.toContain("query:");
    expect(api).not.toContain("body:");
  });

  it("router adds Parent OS without changing Teacher, Student, or Principal defaults", () => {
    const router = read("src/app/router.tsx");
    expect(router).toContain('path="/parent-os"');
    expect(router).toContain("ParentOsShell");
    expect(router).toContain("ParentHomePage");
    expect(router).toContain("ParentChildPage");
    expect(router).toContain('path="/" element={<Navigate to="/teacher-os/today" replace />}');
    expect(router).toContain('path="/teacher-os"');
    expect(router).toContain("TeacherOsShell");
    expect(router).toContain('path="/student-os"');
    expect(router).toContain("StudentOsShell");
    expect(router).toContain('path="/principal-os"');
    expect(router).toContain("PrincipalOsShell");
  });

  it("does not introduce polling, websockets, persistence, AI, or workflow clients", () => {
    const offenders = PARENT_FILES.filter((file) => {
      const text = readFileSync(file, "utf8");
      return /setInterval|WebSocket|localStorage|sessionStorage|indexedDB|fetch\(.*openai|new Worker|@temporalio|nats:\/\//.test(
        text,
      );
    }).map((file) => path.relative(repoRoot, file));
    expect(offenders).toEqual([]);
  });

  it("advances the active consumer snapshot while documenting S02-I03", () => {
    const sync = read("scripts/sync-openapi-snapshot.mjs");
    expect(sync).toContain("138f37bfa7a44c33b206c6b78118154bbb9bc8eb");
    expect(sync).toContain("e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b");
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
