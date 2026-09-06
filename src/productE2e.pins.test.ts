import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const EXPECTED_BACKEND =
  "01c2c54a43d95427aaa3e9a81ceaafe033581743";
const EXPECTED_MIGRATION = "tosd090002";
const EXPECTED_OPENAPI =
  "81C2EC1BC0C14E3F97A5FEECD3A5768BFAC55982BBF0E1EF4E8654138525CE87";
const EXPECTED_FRONTEND_BASE =
  "08887e3f6a427e8e3f5aed852fb3d9a4031a9ff4";
const OBSOLETE_BACKEND = "1fe28f4fd1a2a2070aa69d67daa49cd53ba5820d";
const OBSOLETE_MIGRATION = "tosd080002";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("TOS-DEV10-I02 product-E2E pin consistency", () => {
  it("keeps constants.mjs, harness, seed, bootstrap, and CI on the same pins", () => {
    const constants = read("scripts/product-e2e/constants.mjs");
    expect(constants).toContain(EXPECTED_BACKEND);
    expect(constants).toContain(EXPECTED_MIGRATION);
    expect(constants).toContain(EXPECTED_OPENAPI);
    expect(constants).toContain(EXPECTED_FRONTEND_BASE);
    expect(constants).toMatch(/BACKEND_PIN_SHA\s*=/);
    expect(constants).toMatch(/EXPECTED_MIGRATION_HEAD\s*=\s*"tosd090002"/);
    expect(constants).toMatch(/OPENAPI_AUTHORITY_SHA\s*=/);
    expect(constants).toMatch(/FRONTEND_BASE_SHA\s*=/);
    expect(constants).not.toContain(OBSOLETE_BACKEND);
    expect(constants).not.toContain(OBSOLETE_MIGRATION);

    const harness = read("e2e-product/support/productHarness.ts");
    expect(harness).toContain(`"${EXPECTED_BACKEND}"`);
    expect(harness).toContain(`"${EXPECTED_MIGRATION}"`);
    expect(harness).not.toContain(OBSOLETE_BACKEND);
    expect(harness).not.toContain(OBSOLETE_MIGRATION);

    const seed = read("scripts/product-e2e/seed_precondition.py");
    expect(seed).toContain(`BACKEND_PIN_SHA = "${EXPECTED_BACKEND}"`);
    expect(seed).toContain(
      `EXPECTED_MIGRATION_HEAD = "${EXPECTED_MIGRATION}"`,
    );
    expect(seed).not.toContain(OBSOLETE_BACKEND);
    expect(seed).not.toContain(OBSOLETE_MIGRATION);

    const bootstrap = read("scripts/product-e2e/bootstrap_database.py");
    expect(bootstrap).toContain(EXPECTED_MIGRATION);
    expect(bootstrap).not.toContain(OBSOLETE_MIGRATION);

    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain(`AIEOS_BACKEND_PIN_SHA: ${EXPECTED_BACKEND}`);
    expect(ci).toContain(`ref: ${EXPECTED_BACKEND}`);
    expect(ci).not.toContain(OBSOLETE_BACKEND);

    const readme = read("docs/product-e2e/README.md");
    expect(readme).toContain(EXPECTED_BACKEND);
    expect(readme).toContain(EXPECTED_MIGRATION);
    expect(readme).toContain(EXPECTED_OPENAPI);
    expect(readme).toContain(EXPECTED_FRONTEND_BASE);
    expect(readme).toContain("teacher-os-improve.product.spec.ts");
    expect(readme).toContain("teacher-os-library.product.spec.ts");
    expect(readme).not.toContain("Improve product E2E remains TOS-DEV09-I04");
  });
});
