#!/usr/bin/env node
/**
 * Sync the NON-AUTHORITATIVE consumer OpenAPI snapshot from the AIEOS backend.
 *
 * Usage:
 *   node scripts/sync-openapi-snapshot.mjs
 *   AIEOS_BACKEND_ROOT=../eduvijna-aieos-backend node scripts/sync-openapi-snapshot.mjs
 *   AIEOS_BACKEND_OPENAPI_SHA=551e46e0... node scripts/sync-openapi-snapshot.mjs
 *
 * Expected source (relative to backend root):
 *   contracts/openapi/aieos-v1.json
 *
 * Destination (this repo):
 *   contracts/openapi/aieos-v1.consumer-snapshot.json
 *
 * TOS-DEV10-I04 pinned backend OpenAPI source SHA:
 *   a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24
 * Authoritative Backend OpenAPI SHA-256:
 *   4BF6C88B662D99F1E0E21E6F0AF2D267B39644300D85D99A859A7720F1568411
 *
 * Previous pin (TOS-DEV10-I03R3):
 *   070e479f405f6246a43f1b0fac0aaf5cdd4a1ac0
 *   Consumer OpenAPI SHA-256: ECA7264BAD37D235967D6E4895749777D7D4F9B19FB0D79D79726430D8C57DFB
 *
 * Previous pin (TOS-DEV10-I03R3 pre-CI-fix):
 *   85b3aee257ebfbf70ca1954aa20ae320b150ec47
 *   Consumer OpenAPI SHA-256: ECA7264BAD37D235967D6E4895749777D7D4F9B19FB0D79D79726430D8C57DFB
 *
 * Previous pin (TOS-DEV10-I03R1):
 *   2f034cfe3073db3b7da42f67bf778ea7da5eda4c
 *   Consumer OpenAPI SHA-256: ECA7264BAD37D235967D6E4895749777D7D4F9B19FB0D79D79726430D8C57DFB
 *
 * Previous pin (TOS-DEV10-I03):
 *   79d50f04773ceeb1eca91f7b6561cee2ef2f3151
 *   Consumer OpenAPI SHA-256: 9B36BD1BF21BA4935A8ACA031176F9C57A06EB2E54E3ACA2261A7D7B6C3EDA69
 *
 * Previous pin (TOS-DEV10-I02):
 *   01c2c54a43d95427aaa3e9a81ceaafe033581743
 *   Authoritative Backend OpenAPI SHA-256:
 *   81C2EC1BC0C14E3F97A5FEECD3A5768BFAC55982BBF0E1EF4E8654138525CE87
 *
 * Previous pin (TOS-DEV09-I03):
 *   62733e3ad0d48887f3cd1e1a4486839170a5d651
 *   Consumer OpenAPI SHA-256: B4326D43A213D7831F2AAD8E77A2CEC6BA70B800B4C62EFC52D5B8DFC07CB4D9
 *
 * Previous pin (TOS-DEV08-I03):
 *   1fe28f4fd1a2a2070aa69d67daa49cd53ba5820d
 *   Consumer OpenAPI SHA-256: 824B389D6D4EDB2EA5D8ED3A9E5411087B566DFDCA09C2AB0CD4FDED51C4D89D
 *
 * Previous pin (TOS-DEV07-I03):
 *   551e46e004233421746e4df2789c07367702528b
 *   Consumer OpenAPI SHA-256: 7D7D0E7C7115667757A31CFEB5474F7498ECC7198FB812DE5EF14A0E9F2D289A
 *
 * Previous pin (TOS-DEV06-I04):
 *   06e05277e73e0c71172cae4904efb37d771c3fad
 *   Consumer OpenAPI SHA-256: CCD233062672B36A4DB6C6B60E7413AF8EEC6FDAAE9550270C6879E4C4A06D7C
 *
 * This script copies the file only. It does NOT mutate the backend repo.
 * Update contracts/openapi/README.md when changing the pinned SHA.
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");

const PINNED_SHA = "a6a1cbb5a83fc9feec6a6f5077fcc5e60f60ab24";
const backendRoot =
  process.env.AIEOS_BACKEND_ROOT ||
  path.resolve(frontendRoot, "..", "eduvijna-aieos-backend");
const expectedSha = process.env.AIEOS_BACKEND_OPENAPI_SHA || PINNED_SHA;

const source = path.join(backendRoot, "contracts", "openapi", "aieos-v1.json");
const destDir = path.join(frontendRoot, "contracts", "openapi");
const dest = path.join(destDir, "aieos-v1.consumer-snapshot.json");

if (!existsSync(source)) {
  console.error(
    `[sync-openapi] Source not found: ${source}\n` +
      `Set AIEOS_BACKEND_ROOT to a checkout of eduvijna-aieos-backend at SHA ${expectedSha}.`,
  );
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);

console.log(`[sync-openapi] Copied:`);
console.log(`  from: ${source}`);
console.log(`  to:   ${dest}`);
console.log(
  `[sync-openapi] Reminder: verify backend checkout matches SHA ${expectedSha}, then run pnpm generate:api-types.`,
);
