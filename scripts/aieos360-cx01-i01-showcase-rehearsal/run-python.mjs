import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBackendRoot } from "./constants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runPython(scriptName, extraEnv = {}) {
  const backendRoot = resolveBackendRoot();
  const scriptPath = join(__dirname, scriptName);
  const { VIRTUAL_ENV: _dropVirtualEnv, ...baseEnv } = process.env;
  void _dropVirtualEnv;
  const result = spawnSync(
    process.env.AIEOS360_CX01_I01_SHOWCASE_UV || "uv",
    ["run", "python", scriptPath],
    {
      cwd: backendRoot,
      env: {
        ...baseEnv,
        AIEOS_BACKEND_ROOT: backendRoot,
        PYTHONPATH: [join(backendRoot, "src"), backendRoot, __dirname].join(
          process.platform === "win32" ? ";" : ":",
        ),
        ...extraEnv,
      },
      encoding: "utf8",
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status}`);
  }
}
