#!/usr/bin/env node
/**
 * Proof C: governed owned local PostgreSQL container removed on explicit stop (Docker path).
 * Never uses external CI PostgreSQL service URLs.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CX01_SHOWCASE_CONTAINER, DEDICATED_PG_HOST_PORT } from "./constants.mjs";
import { assertPortsReleased } from "./managed_cleanup.mjs";
import { failClosedNonLinuxExit } from "./linux_platform.mjs";
import { dbReportPath, repoRoot, statusPath } from "./paths.mjs";

failClosedNonLinuxExit("owned_local_pg_cleanup_proof");

if (
  process.env.AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG === "1" ||
  process.env.AIEOS_TEST_DATABASE_URL
) {
  console.error(
    "owned_local_pg_cleanup_proof requires local Docker substrate (no external CI PG env)",
  );
  process.exit(1);
}

const docker = spawnSync("docker", ["version"], { encoding: "utf8" });
if (docker.status !== 0) {
  console.error("Docker required for owned local PostgreSQL cleanup proof");
  process.exit(1);
}

const scriptDir = join(repoRoot, "scripts/aieos360-cx01-i01r9-showcase-rehearsal");

function runNode(script, extraEnv = {}) {
  return spawnSync("node", [join(scriptDir, script)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG: "",
      AIEOS_TEST_DATABASE_URL: "",
      AIEOS_TEST_BOOTSTRAP_DATABASE_URL: "",
      AIEOS_TEST_RUNTIME_DATABASE_URL: "",
      ...extraEnv,
    },
    encoding: "utf8",
    timeout: 600_000,
  });
}

const reset = runNode("reset.mjs");
if (reset.status !== 0) {
  console.error(reset.stdout);
  console.error(reset.stderr);
  process.exit(reset.status ?? 1);
}

const dbReport = JSON.parse(readFileSync(dbReportPath, "utf8"));
if (!dbReport.started_container) {
  console.error("expected local Docker container from reset");
  process.exit(1);
}

const inspectBefore = spawnSync(
  "docker",
  ["inspect", CX01_SHOWCASE_CONTAINER],
  { encoding: "utf8" },
);
if (inspectBefore.status !== 0) {
  console.error("expected governed container to exist after reset");
  process.exit(1);
}

const stop = runNode("stop.mjs");
if (stop.status !== 0) {
  console.error(stop.stdout);
  console.error(stop.stderr);
  process.exit(stop.status ?? 1);
}

const operatorStatus = existsSync(statusPath)
  ? JSON.parse(readFileSync(statusPath, "utf8"))
  : {};
if (operatorStatus.phase !== "stopped") {
  console.error(`expected stopped; got ${operatorStatus.phase}`);
  process.exit(1);
}

const inspectAfter = spawnSync(
  "docker",
  ["inspect", CX01_SHOWCASE_CONTAINER],
  { encoding: "utf8" },
);
const containerMissing = inspectAfter.status !== 0;

try {
  await assertPortsReleased([DEDICATED_PG_HOST_PORT]);
} catch (error) {
  console.error(String(error));
  process.exit(1);
}

const proof = {
  proof: "owned_local_postgresql_cleanup",
  container_name: CX01_SHOWCASE_CONTAINER,
  dedicated_pg_port: DEDICATED_PG_HOST_PORT,
  started_container_after_reset: dbReport.started_container,
  container_missing_after_stop: containerMissing,
  port_55448_released: true,
  owned_local_container_removed: operatorStatus.owned_local_container_removed,
  external_ci_pg_used: false,
};
const out = join(
  repoRoot,
  "tmp",
  "aieos360-cx01-i01-showcase-owned-local-pg-cleanup-proof.json",
);
mkdirSync(join(repoRoot, "tmp"), { recursive: true });
writeFileSync(out, JSON.stringify(proof, null, 2) + "\n", "utf8");
console.log(JSON.stringify(proof, null, 2));
