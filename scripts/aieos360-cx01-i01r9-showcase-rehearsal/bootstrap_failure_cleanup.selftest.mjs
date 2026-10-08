#!/usr/bin/env node
/** Proof: owned local PG container cleanup on bootstrap failures after container start. */
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CX01_SHOWCASE_CONTAINER, DEDICATED_PG_HOST_PORT } from "./constants.mjs";
import { tmpDir } from "./paths.mjs";
import {
  ownershipFilePath,
  readOwnershipRecord,
  writeOwnershipRecord,
} from "./docker_ownership.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../..");

function dockerInspect(name) {
  return spawnSync("docker", ["inspect", name], { encoding: "utf8" });
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function runBootstrap(envExtra) {
  const backendRoot = process.env.AIEOS_BACKEND_ROOT;
  const uv = process.env.AIEOS360_CX01_I01_SHOWCASE_UV || "uv";
  return spawnSync(
    uv,
    ["run", "python", join(scriptDir, "bootstrap_database.py")],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        AIEOS_BACKEND_ROOT: backendRoot,
        AIEOS_TEST_DATABASE_URL: "",
        AIEOS_TEST_BOOTSTRAP_DATABASE_URL: "",
        AIEOS_TEST_RUNTIME_DATABASE_URL: "",
        AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG: "",
        PYTHONPATH: [
          join(backendRoot, "src"),
          backendRoot,
          scriptDir,
        ].join(":"),
        ...envExtra,
      },
      encoding: "utf8",
    },
  );
}

if (spawnSync("docker", ["version"], { encoding: "utf8" }).status !== 0) {
  console.log(JSON.stringify({ ok: true, skipped: "docker_unavailable" }));
  process.exit(0);
}

const backendRoot = process.env.AIEOS_BACKEND_ROOT;
if (!backendRoot) {
  console.log(JSON.stringify({ ok: true, skipped: "AIEOS_BACKEND_ROOT_unset" }));
  process.exit(0);
}

mkdirSync(tmpDir, { recursive: true });

spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], {
  cwd: repoRoot,
  env: process.env,
});

const containerName =
  process.env.AIEOS360_CX01_I01_SHOWCASE_PG_CONTAINER || CX01_SHOWCASE_CONTAINER;

const afterPgFail = runBootstrap({
  AIEOS360_CX01_I01R9_PROOF_BOOTSTRAP_FAIL_AFTER_PG: "1",
});
if (afterPgFail.status === 0) {
  console.error("expected bootstrap to fail under FAIL_AFTER_PG hook");
  spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], { cwd: repoRoot });
  process.exit(1);
}
if (!String(afterPgFail.stderr + afterPgFail.stdout).includes(
  "proof: simulated local bootstrap failure after owned container start",
)) {
  console.error("original bootstrap failure must remain primary error");
  spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], { cwd: repoRoot });
  process.exit(1);
}
if (dockerInspect(containerName).status === 0) {
  console.error("owned container should be removed after FAIL_AFTER_PG");
  spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], { cwd: repoRoot });
  process.exit(1);
}

const reportWriteFail = runBootstrap({
  AIEOS360_CX01_I01R9_PROOF_BOOTSTRAP_REPORT_WRITE_FAIL: "1",
});
if (reportWriteFail.status === 0) {
  console.error("expected bootstrap to fail under REPORT_WRITE_FAIL hook");
  spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], { cwd: repoRoot });
  process.exit(1);
}
if (!String(reportWriteFail.stderr + reportWriteFail.stdout).includes(
  "proof: simulated report write failure",
)) {
  console.error("original report-write failure must remain primary error");
  spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], { cwd: repoRoot });
  process.exit(1);
}
if (dockerInspect(containerName).status === 0) {
  console.error("owned container should be removed after report-write failure");
  spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], { cwd: repoRoot });
  process.exit(1);
}

if (!(await portAvailable(DEDICATED_PG_HOST_PORT))) {
  console.error(`governed port ${DEDICATED_PG_HOST_PORT} should be released after cleanup`);
  spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], { cwd: repoRoot });
  process.exit(1);
}

spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], {
  cwd: repoRoot,
  env: process.env,
});
const ownershipPath = ownershipFilePath();
if (existsSync(ownershipPath)) {
  rmSync(ownershipPath, { recursive: true, force: true });
}
mkdirSync(ownershipPath, { recursive: true });
const ownershipPersistFail = spawnSync("node", [join(scriptDir, "start_governed_pg.mjs")], {
  cwd: repoRoot,
  env: process.env,
  encoding: "utf8",
});
if (ownershipPersistFail.status === 0) {
  console.error("expected governed PG start to fail when ownership persistence is blocked");
  rmSync(ownershipPath, { recursive: true, force: true });
  spawnSync("docker", ["rm", "-f", containerName]);
  process.exit(1);
}
if (
  !String(ownershipPersistFail.stderr + ownershipPersistFail.stdout).match(
    /EISDIR|ownership|ENOENT|not a directory|read-only/i,
  )
) {
  console.error("original ownership persistence failure must remain primary error");
  rmSync(ownershipPath, { recursive: true, force: true });
  spawnSync("docker", ["rm", "-f", containerName]);
  process.exit(1);
}
if (dockerInspect(containerName).status === 0) {
  console.error("governed container must be rolled back after ownership persistence failure");
  rmSync(ownershipPath, { recursive: true, force: true });
  spawnSync("docker", ["rm", "-f", containerName]);
  process.exit(1);
}
if (!(await portAvailable(DEDICATED_PG_HOST_PORT))) {
  console.error(`port ${DEDICATED_PG_HOST_PORT} must be released after ownership rollback`);
  rmSync(ownershipPath, { recursive: true, force: true });
  process.exit(1);
}
try {
  readOwnershipRecord();
  console.error("false successful ownership evidence must not remain after blocked persistence");
  process.exit(1);
} catch {
  /* expected: ownership path is not a readable record */
}
rmSync(ownershipPath, { recursive: true, force: true });

const pgStart = spawnSync("node", [join(scriptDir, "start_governed_pg.mjs")], {
  cwd: repoRoot,
  env: process.env,
  encoding: "utf8",
});
if (pgStart.status !== 0) {
  console.error("failed to start governed PG for ownership-mismatch proof");
  process.exit(1);
}
const ownedRecord = readOwnershipRecord();
if (!ownedRecord?.containerId) {
  console.error("missing ownership record after governed PG start");
  spawnSync("docker", ["rm", "-f", containerName]);
  process.exit(1);
}
writeOwnershipRecord({ ...ownedRecord, containerId: "0000000000000000000000000000000000000000" });
const mismatchRemove = spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], {
  cwd: repoRoot,
  env: process.env,
  encoding: "utf8",
});
if (mismatchRemove.status === 0) {
  console.error("ownership mismatch must refuse destructive container removal");
  spawnSync("docker", ["rm", "-f", containerName]);
  process.exit(1);
}
if (dockerInspect(containerName).status !== 0) {
  console.error("container must remain when ownership verification fails");
  process.exit(1);
}
writeOwnershipRecord(ownedRecord);
spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], { cwd: repoRoot, env: process.env });

const externalOnly = spawnSync(
  process.env.AIEOS360_CX01_I01_SHOWCASE_UV || "uv",
  ["run", "python", join(scriptDir, "bootstrap_database.py")],
  {
    cwd: backendRoot,
    env: {
      ...process.env,
      AIEOS_BACKEND_ROOT: backendRoot,
      AIEOS360_CX01_I01R9_PROOF_BOOTSTRAP_FAIL_AFTER_PG: "1",
      AIEOS_TEST_DATABASE_URL: "postgresql://example:example@127.0.0.1:5432/aieos",
      AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG: "1",
      PYTHONPATH: [join(backendRoot, "src"), backendRoot, scriptDir].join(":"),
    },
    encoding: "utf8",
  },
);
if (externalOnly.status === 0) {
  console.error("external CI PG path with fail hook should fail without local container bootstrap");
  process.exit(1);
}
if (dockerInspect(containerName).status === 0) {
  console.error("external CI PG path must not start/remove governed local container");
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    cases: [
      "bootstrap_failure_owned_pg_cleanup",
      "bootstrap_report_write_failure_cleanup",
      "ownership_persistence_failure_container_rollback",
      "ownership_mismatch_refuses_removal",
      "external_ci_pg_untouched",
    ],
    container: containerName,
    port: DEDICATED_PG_HOST_PORT,
  }),
);
