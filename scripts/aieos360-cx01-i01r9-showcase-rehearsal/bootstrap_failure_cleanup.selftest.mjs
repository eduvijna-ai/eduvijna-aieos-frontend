#!/usr/bin/env node
/** Proof: owned local PG container is removed when bootstrap fails after start. */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CX01_SHOWCASE_CONTAINER } from "./constants.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../..");

function dockerInspect(name) {
  return spawnSync("docker", ["inspect", name], { encoding: "utf8" });
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

spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], {
  cwd: repoRoot,
  env: process.env,
});

const uv = process.env.AIEOS360_CX01_I01_SHOWCASE_UV || "uv";
const bootstrap = spawnSync(
  uv,
  ["run", "python", join(scriptDir, "bootstrap_database.py")],
  {
    cwd: backendRoot,
    env: {
      ...process.env,
      AIEOS_BACKEND_ROOT: backendRoot,
      AIEOS360_CX01_I01R9_PROOF_BOOTSTRAP_FAIL_AFTER_PG: "1",
      AIEOS_TEST_DATABASE_URL: "",
      AIEOS_TEST_BOOTSTRAP_DATABASE_URL: "",
      AIEOS_TEST_RUNTIME_DATABASE_URL: "",
      AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG: "",
      PYTHONPATH: [
        join(backendRoot, "src"),
        backendRoot,
        scriptDir,
      ].join(":"),
    },
    encoding: "utf8",
  },
);

if (bootstrap.status === 0) {
  console.error("expected bootstrap to fail under proof hook");
  spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], { cwd: repoRoot });
  process.exit(1);
}

const containerName =
  process.env.AIEOS360_CX01_I01_SHOWCASE_PG_CONTAINER || CX01_SHOWCASE_CONTAINER;
const inspect = dockerInspect(containerName);
if (inspect.status === 0) {
  console.error("owned container should be removed after bootstrap failure");
  spawnSync("node", [join(scriptDir, "remove_owned_pg.mjs")], { cwd: repoRoot });
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    case: "bootstrap_failure_owned_pg_cleanup",
    container: containerName,
    bootstrap_exit: bootstrap.status,
  }),
);
