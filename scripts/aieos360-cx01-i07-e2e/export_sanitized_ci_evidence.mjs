#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildI07PythonBootstrapEnv } from "./child_env.mjs";
import { resolveBackendRoot } from "./constants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolveBackendRoot();
const result = spawnSync(
  process.env.AIEOS360_CX01_I07_E2E_UV || "uv",
  ["run", "python", join(__dirname, "export_sanitized_ci_evidence.py")],
  {
    cwd: backendRoot,
    env: buildI07PythonBootstrapEnv(process.env, {
      AIEOS_BACKEND_ROOT: backendRoot,
      PYTHONPATH: [join(backendRoot, "src"), backendRoot, __dirname].join(":"),
    }),
    encoding: "utf8",
    stdio: "inherit",
  },
);
process.exit(result.status ?? 1);
