import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const CX01_ARCHITECTURE = "491295c3cf0a151f31686a6a2e1a2176cd92c782";
const CX01_PRODUCT = "b4b3048fb7a6a1c50ae8619dc490743714f2e3e2";
const CX01_INFRASTRUCTURE = "a8654e5bc680eac1fa93cf8308d7cad904f4d7b9";
const CX01_FRONTEND_BASE = "80125be6cf172afb5137e845752c5b4505e5a97f";
const CX01_BACKEND = "637583f42b7c475ef83f6f99bca7e65e665a253d";
const CX01_OPENAPI =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";
const CX01_ALEMBIC = "a360s010004";
const CX01_SCENARIO = "aieos360-cx01-i01-showcase-rehearsal";
const CX01_CONTAINER = "aieos-aieos360-cx01-i01-showcase-pg";
const SCRIPT_PKG = "scripts/aieos360-cx01-i01r9-showcase-rehearsal";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-CX01-I01R9 showcase rehearsal pin and package consistency", () => {
  it("pins governed Architecture/Product/Infrastructure/Frontend/Backend/OpenAPI/Alembic exactly", () => {
    const constants = read(`${SCRIPT_PKG}/constants.mjs`);
    expect(constants).toContain(CX01_ARCHITECTURE);
    expect(constants).toContain(CX01_PRODUCT);
    expect(constants).toContain(CX01_INFRASTRUCTURE);
    expect(constants).toContain(CX01_FRONTEND_BASE);
    expect(constants).toContain(CX01_BACKEND);
    expect(constants).toContain(CX01_OPENAPI);
    expect(constants).toContain(CX01_ALEMBIC);
    expect(constants).toContain(CX01_SCENARIO);
    expect(constants).toContain(CX01_CONTAINER);
  });

  it("exposes operator reset/start/status/stop commands and dedicated rehearsal ports", () => {
    const pkg = read("package.json");
    expect(pkg).toContain('"showcase:aieos360:reset"');
    expect(pkg).toContain('"showcase:aieos360:start"');
    expect(pkg).toContain('"showcase:aieos360:status"');
    expect(pkg).toContain('"showcase:aieos360:stop"');
    expect(pkg).toContain("aieos360-cx01-i01r9-showcase-rehearsal");

    const constants = read(`${SCRIPT_PKG}/constants.mjs`);
    expect(constants).toContain("55448");
    expect(constants).toContain("8020");
    expect(constants).toContain("5291");
  });

  it("uses Linux-only managed process groups (no PR#34 interactive shutdown framework)", () => {
    const start = read(`${SCRIPT_PKG}/start.mjs`);
    expect(start).toContain("linux_platform.mjs");
    expect(start).toContain("process_group.mjs");
    expect(start).toContain('start_mode: "managed"');
    expect(start).not.toContain("executeCanonicalShutdown");
    expect(start).not.toContain("SIGINT");

    const stop = read(`${SCRIPT_PKG}/stop.mjs`);
    expect(stop).toContain("stopRegisteredProcessGroups");
    expect(stop).not.toContain("canonical_shutdown");

    const lifecycle = read(`${SCRIPT_PKG}/lifecycle_proof.mjs`);
    expect(lifecycle).toContain("start.mjs");
    expect(lifecycle).toContain("stop.mjs");
    expect(lifecycle).toContain("four_role_runtime_proof.py");
    expect(lifecycle).not.toContain("foreground_start_sigint");
  });

  it("keeps historical S04-I03 pins unchanged", () => {
    const s04 = read("scripts/aieos360-s04-i03-e2e/constants.mjs");
    expect(s04).toContain(CX01_BACKEND);
    expect(s04).toContain("aieos-aieos360-s04-i03-e2e-pg");
    expect(s04).not.toContain(CX01_CONTAINER);
  });

  it("adds bounded I01R9 CI lane", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("aieos360-cx01-i01r9-showcase:");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${CX01_BACKEND}`);
    expect(ci).toContain("pnpm test:cx01-i01r9-showcase-proof");
    expect(ci).not.toContain("foreground_start_sigint_proof");
  });

  it("keeps integration proofs opt-in only", () => {
    const proof = read("src/aieos360Cx01I01R9Showcase.proof.test.ts");
    expect(proof).toContain(
      'process.env.AIEOS360_CX01_I01_SHOWCASE_INTEGRATION === "1"',
    );
    expect(proof).not.toContain('process.env.CI === "true"');
  });
});
