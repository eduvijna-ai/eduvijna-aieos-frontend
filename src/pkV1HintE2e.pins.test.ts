import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const EXPECTED_BACKEND =
  "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa";
const EXPECTED_MIGRATION = "a360s010005";
const EXPECTED_OPENAPI =
  "0061BCF6065FAFA184F196829A87AF98ADEDFCE6B633D45704141A5B48045D22";
const EXPECTED_FRONTEND_BASE =
  "e3a6b4a307edf359a00e027fd50f872751934f5b";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function run(cmd: string, args: string[]) {
  return spawnSync(cmd, args, { cwd: repoRoot, encoding: "utf8" });
}

describe("PK-V1-HINT-E2E-I01R1 pin and security consistency", () => {
  it("keeps hint E2E pins additive and historical lanes intact", () => {
    const constants = read("scripts/pk-v1-hint-e2e/constants.mjs");
    expect(constants).toContain(EXPECTED_BACKEND);
    expect(constants).toContain(EXPECTED_MIGRATION);
    expect(constants).toContain(EXPECTED_OPENAPI);
    expect(constants).toContain(EXPECTED_FRONTEND_BASE);

    const harness = read("e2e-pk-v1-hint/support/pkV1HintHarness.ts");
    expect(harness).toContain(`"${EXPECTED_BACKEND}"`);
    expect(harness).toContain(`"${EXPECTED_MIGRATION}"`);
    expect(harness).toContain(`"${EXPECTED_OPENAPI}"`);

    const seed = read("scripts/pk-v1-hint-e2e/seed_precondition.py");
    expect(seed).toContain(`BACKEND_PIN_SHA = "${EXPECTED_BACKEND}"`);
    expect(seed).toContain(`EXPECTED_MIGRATION_HEAD = "${EXPECTED_MIGRATION}"`);
    expect(seed).not.toMatch(/print\(json\.dumps\(fixture/i);

    const bootstrap = read("scripts/pk-v1-hint-e2e/bootstrap_database.py");
    expect(bootstrap).not.toContain("start_postgres(");
    expect(bootstrap).toContain("public_bootstrap_summary");

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("pk-v1-hint-e2e");
    expect(ci).toContain(`ref: ${EXPECTED_BACKEND}`);
    expect(ci).toContain("PK_V1_HINT_E2E_CI_EXTERNAL_PG");
    expect(ci).not.toContain("tmp/pk-v1-hint-e2e-fixture.json");
    expect(ci).not.toContain("tmp/pk-v1-hint-e2e-db.json");

    const playwrightConfig = read("playwright.pk-v1-hint-e2e.config.ts");
    expect(playwrightConfig).toContain('trace: "off"');
    expect(playwrightConfig).toContain('screenshot: "off"');

    const i05 = read("scripts/aieos360-i05-e2e/constants.mjs");
    expect(i05).toContain("3d25bb2d7ae3a6a95affdf075a75f20db48a6959");
  });

  it("runs static DSN and sanitize guard tests without Docker", () => {
    const dsn = run("python3", [
      "scripts/pk-v1-hint-e2e/dsn_contract_test.py",
    ]);
    expect(dsn.status, dsn.stderr || dsn.stdout).toBe(0);

    const sanitize = run("python3", [
      "scripts/pk-v1-hint-e2e/export_sanitize_test.py",
    ]);
    expect(sanitize.status, sanitize.stderr || sanitize.stdout).toBe(0);

    const docker = run("node", [
      "scripts/pk-v1-hint-e2e/docker_ownership.selftest.mjs",
    ]);
    expect(docker.status, docker.stderr || docker.stdout).toBe(0);
  });

  it("requires q-open hint binding in Playwright vertical", () => {
    const spec = read("e2e-pk-v1-hint/learner-hint-vertical.product.spec.ts");
    expect(spec).toContain("Show hint for question 4");
    expect(spec).toContain("assert-evaluation");
    expect(spec).toContain("assert-remediation-origin");
  });
});