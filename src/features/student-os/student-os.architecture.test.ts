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

const STUDENT_OS_FILES = walk(
  path.join(repoRoot, "src/features/student-os"),
).filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"));

const REQUIRED_OPERATION_IDS = [
  "student_os_home",
  "student_os_assignment_list",
  "student_os_assignment_get",
  "learning_attempt_start",
  "learning_attempt_get",
  "learning_attempt_save_responses",
  "learning_attempt_submit",
] as const;

describe("AIEOS360-S01-I04 Student OS architecture", () => {
  it("pins the merged I03 OpenAPI digest", () => {
    const sync = read("scripts/sync-openapi-snapshot.mjs");
    expect(sync).toContain("921d35eb08890a4e1d86cf95daf9d38cdfc4a13c");
    const digest = createHash("sha256")
      .update(
        readFileSync(
          path.join(repoRoot, "contracts/openapi/aieos-v1.consumer-snapshot.json"),
        ),
      )
      .digest("hex")
      .toUpperCase();
    expect(digest).toBe(
      "4691D6BADA2157D436435BB5CCDD6797EA670D1A87543D42CA39A478F940F330",
    );
  });

  it("generated contract includes Student OS and Learning attempt operations", () => {
    const snapshot = read("contracts/openapi/aieos-v1.consumer-snapshot.json");
    const generated = read("src/services/api/generated/aieos-v1.ts");
    const api = read("src/services/api/studentLearningApi.ts");
    for (const operationId of REQUIRED_OPERATION_IDS) {
      expect(snapshot).toContain(`"operationId": "${operationId}"`);
      expect(generated).toContain(operationId);
    }
    expect(api).toContain("/api/v1/student-os/home");
    expect(api).toContain("/api/v1/student-os/assignments");
    expect(api).toContain("/api/v1/learning/assignments/");
    expect(api).toContain("/api/v1/learning/attempts/");
  });

  it("does not access PostgreSQL, PostgREST, NATS, audit, or Assessment Intelligence", () => {
    const forbidden =
      /postgres|postgrest|supabase|nats:\/\/|jetstream|mastery|misconception|next-best|student agent|assessment insight|grading intelligence|\/api\/v1\/improvements/i;
    const offenders = STUDENT_OS_FILES.filter((file) =>
      forbidden.test(readFileSync(file, "utf8")),
    ).map((file) => path.relative(repoRoot, file));
    expect(offenders).toEqual([]);
    const api = read("src/services/api/studentLearningApi.ts");
    expect(api).not.toMatch(/postgres|postgrest/i);
    expect(api).not.toContain("/rest/v1/");
  });

  it("does not fabricate cursors or bypass Idempotency-Key", () => {
    const list = read(
      "src/features/student-os/assignments/AssignmentsPage.tsx",
    );
    const api = read("src/services/api/studentLearningApi.ts");
    const detail = read(
      "src/features/student-os/assignments/AssignmentDetailPage.tsx",
    );
    const attempt = read("src/features/student-os/attempts/AttemptPage.tsx");
    expect(list).toContain("data.next_cursor");
    expect(list).not.toMatch(/btoa\(|page \+|offset/);
    expect(api).toContain("Idempotency-Key");
    expect(api).toContain("If-Match");
    expect(detail).toContain("retainOrMintIdempotencyKey");
    expect(attempt).toContain("retainOrMintIdempotencyKey");
  });

  it("keeps Teacher OS routes intact", () => {
    const router = read("src/app/router.tsx");
    expect(router).toContain('path="/teacher-os"');
    expect(router).toContain("TeacherOsShell");
    expect(router).toContain("StudentOsShell");
    expect(router).toContain("TeacherAssignmentDetailPage");
    expect(router).toContain("StudentAssignmentDetailPage");
  });
});
