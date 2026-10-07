import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const scriptPkg = "scripts/aieos360-cx01-i01r9-showcase-rehearsal";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-CX01-I01R9 Codex correction regressions", () => {
  it("publishes role-specific frontend entry URLs", () => {
    const result = spawnSync(
      "node",
      [path.join(repoRoot, scriptPkg, "role_urls.selftest.mjs")],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    const start = read(`${scriptPkg}/start.mjs`);
    expect(start).toContain("buildRoleUrls");
    const manifestEmitter = read(`${scriptPkg}/emit_manifest.py`);
    expect(manifestEmitter).toContain("/student-os/home");
    expect(manifestEmitter).toContain("/principal-os");
    expect(manifestEmitter).toContain("/parent-os");
  });

  it("default status probes live services when phase is running", () => {
    const status = read(`${scriptPkg}/status.mjs`);
    expect(status).toContain('operatorPhase === "running"');
    expect(status).toContain("waitForHttpOk");
    expect(status).toContain("STATUS_SKIP_LIVE");
    expect(status).not.toContain('REQUIRE_LIVE === "1"');
    expect(status).toContain("registry_truth");
  });

  it("cleans managed children on startup failure", () => {
    const start = read(`${scriptPkg}/start.mjs`);
    expect(start).toContain("cleanupManagedStack");
    expect(start).toContain('phase: "start_failed"');
    const partialProof = read(`${scriptPkg}/partial_start_cleanup_proof.mjs`);
    expect(partialProof).toContain("AIEOS360_CX01_I01R9_PROOF_FAIL_STUDENT_BACKEND");
    expect(partialProof).not.toContain("59997");
    const studentServe = read(`${scriptPkg}/serve_student_app.py`);
    expect(studentServe).toContain("AIEOS360_CX01_I01R9_PROOF_FAIL_STUDENT_BACKEND");
  });

  it("stop removes only governed owned local PostgreSQL when lifecycle started it", () => {
    const stop = read(`${scriptPkg}/stop.mjs`);
    expect(stop).toContain("removeOwnedLocalContainer");
    expect(stop).toContain("localOwnedContainerExpected");
    const cleanup = read(`${scriptPkg}/managed_cleanup.mjs`);
    expect(cleanup).toContain("removeOwnedContainer");
    expect(cleanup).toContain("usesExternalCiPostgres");
  });

  it("redacts bearer fields from seed stdout", () => {
    const seed = read(`${scriptPkg}/seed_precondition.py`);
    expect(seed).toContain("sanitize_object(fixture)");
    expect(seed).not.toMatch(/print\(json\.dumps\(fixture,/);
  });

  it("uses one shared stop-wide deadline for all process groups", () => {
    const pg = read(`${scriptPkg}/process_group.mjs`);
    expect(pg).toContain("stopDeadlineAt");
    expect(pg).toContain("resolveStopTimeoutMs");
    expect(pg).toContain("classifyRegistryEntry");
    expect(pg).toContain("already_stopped");
    expect(pg).toContain("unsafe_identity_mismatch");
    const result = spawnSync(
      "node",
      [path.join(repoRoot, scriptPkg, "process_group_stop.selftest.mjs")],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
  });

  it("pin guard rejects tracked changes but ignores untracked files", () => {
    const pinGuard = read(`${scriptPkg}/pin_guard.mjs`);
    expect(pinGuard).toContain("--untracked-files=no");
    const result = spawnSync(
      "node",
      [path.join(repoRoot, scriptPkg, "pin_guard_tracked_tree.selftest.mjs")],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  });
});
