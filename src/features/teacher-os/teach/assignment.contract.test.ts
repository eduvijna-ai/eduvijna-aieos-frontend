import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const snapshotPath = path.join(
  repoRoot,
  "contracts/openapi/aieos-v1.consumer-snapshot.json",
);
const generatedPath = path.join(
  repoRoot,
  "src/services/api/generated/aieos-v1.ts",
);

const REQUIRED_OPERATION_IDS = [
  "teacher_os_school_context_classes_list",
  "teaching_assignment_create",
  "teaching_assignment_list",
  "teaching_assignment_get",
  "teaching_assignment_due_update",
  "teaching_assignment_close",
  "teaching_assignment_cancel",
  "teacher_os_teach_context_get",
  "teaching_execution_list",
  "teaching_execution_start",
  "teaching_execution_get",
  "teaching_execution_complete",
  "teaching_execution_cancel",
  "teaching_execution_observation_create",
  "teaching_execution_observation_correct",
  "assessment_classroom_list",
  "assessment_classroom_record",
  "assessment_classroom_get",
  "assessment_classroom_correct",
  "assessment_classroom_void",
  "teaching_work_from_classroom_assessment_create",
  "teacher_os_library_list",
  "teacher_os_library_get",
  "teacher_os_library_version_get",
  "teacher_os_memory_get",
  "teacher_os_memory_create",
  "teacher_os_memory_update",
  "teacher_os_assistant_respond",
  "platform_ai_providers_get",
] as const;

describe("TOS-DEV10-I03 OpenAPI consumer contract", () => {
  it("pins Backend OpenAPI source SHA in sync script", () => {
    const syncScript = readFileSync(
      path.join(repoRoot, "scripts/sync-openapi-snapshot.mjs"),
      "utf8",
    );
    expect(syncScript).toContain(
      "3d25bb2d7ae3a6a95affdf075a75f20db48a6959",
    );
    expect(syncScript).toContain(
      "7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB",
    );
  });

  it("consumer snapshot SHA-256 matches Backend OpenAPI authority", () => {
    const bytes = readFileSync(snapshotPath);
    const digest = createHash("sha256")
      .update(bytes)
      .digest("hex")
      .toUpperCase();
    expect(digest).toBe(
      "7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB",
    );
  });

  it("snapshot and generated types include Assistant + Memory + Assessment + remediation operationIds", () => {
    const snapshot = readFileSync(snapshotPath, "utf8");
    const generated = readFileSync(generatedPath, "utf8");
    for (const operationId of REQUIRED_OPERATION_IDS) {
      expect(snapshot).toContain(`"operationId": "${operationId}"`);
      expect(generated).toContain(operationId);
    }
  });

  it("does not invent an /improvements API or learner/mastery surface", () => {
    const snapshot = readFileSync(snapshotPath, "utf8");
    expect(snapshot).not.toMatch(/\/api\/v1\/improvements/);
    expect(snapshot).not.toMatch(/operationId": ".*mastery/);
    expect(snapshot).not.toMatch(/\/api\/v1\/learners/);
    expect(snapshot).toContain('"operationId": "teacher_os_memory_get"');
    expect(snapshot).toContain("/api/v1/teacher-os/memory");
  });
});
