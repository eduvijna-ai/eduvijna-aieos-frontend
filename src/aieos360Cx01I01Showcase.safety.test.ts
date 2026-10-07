import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const scriptDir = path.join(
  repoRoot,
  "scripts/aieos360-cx01-i01-showcase-rehearsal",
);

function runContractCheck(env: Record<string, string>) {
  return spawnSync("python3", [path.join(scriptDir, "reset_target_contract.py")], {
    cwd: repoRoot,
    env: { ...process.env, ...env, PYTHONPATH: scriptDir },
    encoding: "utf8",
  });
}

function runResetSafety(env: Record<string, string>) {
  return spawnSync("python3", [path.join(scriptDir, "reset_safety.py")], {
    cwd: repoRoot,
    env: { ...process.env, ...env, PYTHONPATH: scriptDir },
    encoding: "utf8",
  });
}

const governedCiEnv = {
  AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG: "1",
  AIEOS_TEST_BOOTSTRAP_DATABASE_URL:
    "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos",
  AIEOS_TEST_DATABASE_URL:
    "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos",
  AIEOS_TEST_RUNTIME_DATABASE_URL:
    "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos",
};

describe("AIEOS360-CX01-I01 reset target contract (non-destructive)", () => {
  it("accepts governed CI external PostgreSQL URLs with explicit authorization", () => {
    const result = runContractCheck(governedCiEnv);
    expect(result.status).toBe(0);
  });

  it("rejects external URLs without caller CI authorization flag", () => {
    const { AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG: _drop, ...env } =
      governedCiEnv;
    void _drop;
    const result = runContractCheck(env);
    expect(result.status).not.toBe(0);
  });

  it("rejects password-substring host spoofing (credential in hostname)", () => {
    const result = runContractCheck({
      ...governedCiEnv,
      AIEOS_TEST_RUNTIME_DATABASE_URL:
        "postgresql+psycopg://aieos_runtime:aieos_test@evil-aieos_test.example:5432/aieos",
    });
    expect(result.status).not.toBe(0);
  });

  it("rejects migrator URL with wrong database role", () => {
    const result = runContractCheck({
      ...governedCiEnv,
      AIEOS_TEST_DATABASE_URL:
        "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos",
    });
    expect(result.status).not.toBe(0);
  });

  it("rejects PostgreSQL URL query-string host override", () => {
    const result = runContractCheck({
      ...governedCiEnv,
      AIEOS_TEST_DATABASE_URL:
        "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos?host=evil.example",
    });
    expect(result.status).not.toBe(0);
  });

  it("reset_safety fails closed without mutating when contract is invalid", () => {
    const result = runResetSafety({
      AIEOS_TEST_DATABASE_URL:
        "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("RESET BLOCKED");
  });
});

describe("AIEOS360-CX01-I01 docker inspect classification (non-destructive)", () => {
  it("fail-closed on daemon errors and malformed JSON", () => {
    const result = spawnSync(
      "node",
      [path.join(scriptDir, "docker_inspect_selftest.mjs")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
  });
});

describe("AIEOS360-CX01-I01 process tree deadlines (non-destructive)", () => {
  it("uses one shared grace window for multiple PIDs", () => {
    const result = spawnSync(
      "node",
      [path.join(scriptDir, "process_tree_deadline_selftest.mjs")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
  });

  it("uses one stop-wide grace/kill budget across multiple registry roots", () => {
    const result = spawnSync(
      "node",
      [path.join(scriptDir, "stop_wide_deadline_selftest.mjs")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  });

  it("reports stop_failed when simulateStopFailure is set under harness", () => {
    const result = spawnSync(
      "node",
      [path.join(scriptDir, "canonical_shutdown_simulate_fail_selftest.mjs")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
  });

  it("cleans token-owned descendants when the registered root is already dead", () => {
    const result = spawnSync(
      "node",
      [path.join(scriptDir, "stop_wide_orphan_selftest.mjs")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  });

  it("rescans late-spawned token-owned descendants during shutdown", () => {
    const result = spawnSync(
      "node",
      [path.join(scriptDir, "stop_wide_late_spawn_selftest.mjs")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  });

  it("retries stop with survivor birth identity bound to live PID", () => {
    const result = spawnSync(
      "node",
      [path.join(scriptDir, "survivor_registry_retry_selftest.mjs")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  });
});

describe("AIEOS360-CX01-I01 process ownership (non-destructive)", () => {
  it("verifies birth identity and ownership token on live child", () => {
    const result = spawnSync(
      "node",
      [path.join(scriptDir, "process_identity_selftest.mjs")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  });
});
