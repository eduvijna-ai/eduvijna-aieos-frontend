import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const I03_ARCHITECTURE = "67f4020b78cacdf1716e18d83f4410cb16fdcb4d";
const I03_BACKEND = "138f37bfa7a44c33b206c6b78118154bbb9bc8eb";
const I03_FRONTEND_BASE = "1b4263d0668f66d84cc261c79a2e81883375219e";
const I03_OPENAPI =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";
const I03_ALEMBIC = "a360s010004";
const S02_I03_BACKEND = "e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b";
const S02_I03_OPENAPI =
  "BE60CC2A4612F77AB333088D264B9501B9AB842995AEC1539DA89EA0E8462B47";
const I05_E2E_BACKEND = "3d25bb2d7ae3a6a95affdf075a75f20db48a6959";
const TEACHER_PRODUCT_BACKEND =
  "a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24";
const STUDENT_PRODUCT_BACKEND =
  "921d35eb08890a4e1d86cf95daf9d38cdfc4a13c";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("AIEOS360-S03-I03 Parent OS consumer contract pin", () => {
  it("pins Architecture, Backend, Frontend base, OpenAPI, and Alembic", () => {
    const pins = read("src/aieos360S03I03.pins.test.ts");
    expect(pins).toContain(I03_ARCHITECTURE);
    expect(pins).toContain(I03_BACKEND);
    expect(pins).toContain(I03_FRONTEND_BASE);
    expect(pins).toContain(I03_OPENAPI);
    expect(pins).toContain(I03_ALEMBIC);

    const docs = read("docs/AIEOS360-S03-I03-PARENT-OS-FRONTEND-READ-JOURNEY.md");
    expect(docs).toContain(I03_ARCHITECTURE);
    expect(docs).toContain(I03_BACKEND);
    expect(docs).toContain(I03_FRONTEND_BASE);
    expect(docs).toContain(I03_OPENAPI);
    expect(docs).toContain(I03_ALEMBIC);

    const sync = read("scripts/sync-openapi-snapshot.mjs");
    expect(sync).toContain(`const PINNED_SHA = "${I03_BACKEND}"`);
    expect(sync).toContain(I03_OPENAPI);

    const digest = createHash("sha256")
      .update(
        readFileSync(
          path.join(repoRoot, "contracts/openapi/aieos-v1.consumer-snapshot.json"),
        ),
      )
      .digest("hex")
      .toUpperCase();
    expect(digest).toBe(I03_OPENAPI);

    const readme = read("contracts/openapi/README.md");
    expect(readme).toContain(I03_BACKEND);
    expect(readme).toContain(I03_OPENAPI);
  });

  it("generated types include Parent Intelligence GET only", () => {
    const generated = read("src/services/api/generated/aieos-v1.ts");
    const snapshot = read("contracts/openapi/aieos-v1.consumer-snapshot.json");
    expect(generated).toContain("ParentIntelligenceResponse");
    expect(generated).toContain("ParentChildCardResponse");
    expect(generated).toContain("ParentAssignmentStatusResponse");
    expect(generated).toContain("parent_os_home_get");
    expect(generated).toContain("parent_os_child_get");
    expect(generated).toContain('"/api/v1/parent-os/home"');
    expect(generated).toContain(
      '"/api/v1/parent-os/children/{learner_principal_id}"',
    );
    expect(snapshot).toContain('"operationId": "parent_os_home_get"');
    expect(snapshot).toContain('"operationId": "parent_os_child_get"');

    const homeStart = generated.indexOf('"/api/v1/parent-os/home"');
    const nextHome = generated.indexOf('"/api/v1/', homeStart + 1);
    const homePath = generated.slice(homeStart, nextHome);
    expect(homePath).toContain('get: operations["parent_os_home_get"]');
    expect(homePath).toContain("post?: never");
    expect(homePath).toContain("put?: never");
    expect(homePath).toContain("patch?: never");
    expect(homePath).toContain("delete?: never");

    const childStart = generated.indexOf(
      '"/api/v1/parent-os/children/{learner_principal_id}"',
    );
    const nextChild = generated.indexOf('"/api/v1/', childStart + 1);
    const childPath = generated.slice(childStart, nextChild);
    expect(childPath).toContain('get: operations["parent_os_child_get"]');
    expect(childPath).toContain("post?: never");
    expect(childPath).toContain("put?: never");
    expect(childPath).toContain("patch?: never");
    expect(childPath).toContain("delete?: never");
  });

  it("leaves historical S02/S01/Teacher/Student E2E pins unchanged", () => {
    const s02i04 = read("src/aieos360S02I04E2e.pins.test.ts");
    expect(s02i04).toContain(S02_I03_BACKEND);
    expect(s02i04).toContain(S02_I03_OPENAPI);
    expect(s02i04).not.toContain(I03_BACKEND);

    const i05 = read("src/aieos360I05E2e.pins.test.ts");
    expect(i05).toContain(I05_E2E_BACKEND);
    expect(i05).not.toContain(I03_BACKEND);

    const teacher = read("src/productE2e.pins.test.ts");
    expect(teacher).toContain(TEACHER_PRODUCT_BACKEND);
    expect(teacher).not.toContain(I03_BACKEND);

    const student = read("src/studentProductE2e.pins.test.ts");
    expect(student).toContain(STUDENT_PRODUCT_BACKEND);
    expect(student).not.toContain(I03_BACKEND);

    const i04Constants = read("scripts/aieos360-s02-i04-e2e/constants.mjs");
    expect(i04Constants).toContain(S02_I03_BACKEND);
    expect(i04Constants).not.toContain(I03_BACKEND);
  });
});
