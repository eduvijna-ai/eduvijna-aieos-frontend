import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const I06_SCRIPT_PKG = "scripts/aieos360-cx01-i06-showcase-ai-mode";
const I01_SCRIPT_PKG = "scripts/aieos360-cx01-i01r9-showcase-rehearsal";
const GOVERNED_FRONTEND = "8c8247afda0b9a34e688d2c300d46e83526bb126";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function runNode(scriptRelativePath: string, extraEnv: Record<string, string> = {}) {
  return spawnSync("node", [path.join(repoRoot, scriptRelativePath)], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
}

describe("AIEOS360-CX01-I06 showcase AI mode governance", () => {
  it("pins governed frontend base SHA for I06 handoff", () => {
    expect(read(`${I01_SCRIPT_PKG}/constants.mjs`)).toContain(GOVERNED_FRONTEND);
    expect(read(`${I06_SCRIPT_PKG}/constants.mjs`)).toContain(GOVERNED_FRONTEND);
  });

  it("defaults to DETERMINISTIC and rejects invalid REAL_AI without operator secrets in harness children", () => {
    const selftest = runNode(`${I06_SCRIPT_PKG}/i06_mode.selftest.mjs`);
    expect(selftest.status).toBe(0);

    const start = read(`${I01_SCRIPT_PKG}/start.mjs`);
    expect(start).toContain("resolveShowcaseModeForStart");
    expect(start).toContain("scrubAllProviderSurface");
    expect(start).toContain("buildTeacherBackendEnv");
    expect(start).not.toContain("REAL_AI query");
  });

  it("keeps teacher REAL_AI composition in serve_teacher_app without fake fallback", () => {
    const teacher = read(`${I01_SCRIPT_PKG}/serve_teacher_app.py`);
    expect(teacher).toContain("compose_configured_model_provider");
    expect(teacher).toContain("REAL_AI showcase mode cannot compose Development Fake gateway");
    expect(teacher).toContain("provider_runtime=provider_runtime");
  });

  it("scrubs provider secrets from python harness helpers", () => {
    const runPython = read(`${I01_SCRIPT_PKG}/run-python.mjs`);
    expect(runPython).toContain("scrubAllProviderSurface");
  });

  it("surfaces runtime truth in launcher without exposing secrets", () => {
    const launcher = read("src/features/aieos360-showcase/Aieos360ShowcaseLauncherPage.tsx");
    expect(launcher).toContain("ShowcaseModeTruthPanel");
    const panel = read("src/features/aieos360-showcase/ShowcaseModeTruthPanel.tsx");
    expect(panel).toContain("/api/v1/platform/ai/providers");
    expect(panel).not.toMatch(/API_KEY|bearer/i);
    expect(read(".gitignore")).toContain("public/aieos360-showcase-runtime.json");
  });

  it("verifies governed five-repo refs when source gate is invoked", () => {
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { verifyGovernedFiveRepoRefs, verifyOpenApiSnapshotSha } from './${I06_SCRIPT_PKG}/source_gate.mjs';
verifyOpenApiSnapshotSha();
const refs = verifyGovernedFiveRepoRefs();
if (Object.keys(refs).length !== 5) process.exit(2);`,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  });

  it("fail-closes REAL_AI without provider key before managed role spawn", () => {
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { resolveShowcaseModeForStart } from './${I06_SCRIPT_PKG}/mode.mjs';
try {
  resolveShowcaseModeForStart({
    AIEOS360_CX01_I06_SHOWCASE_MODE: 'REAL_AI',
    AIEOS_AI_PROVIDER: 'groq',
  });
  process.exit(3);
} catch (error) {
  if (!String(error).includes('AIEOS_GROQ_API_KEY')) process.exit(4);
}`,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
  });
});
