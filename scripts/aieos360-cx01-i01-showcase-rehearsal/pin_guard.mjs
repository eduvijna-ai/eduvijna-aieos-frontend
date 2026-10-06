import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  BACKEND_PIN_SHA,
  EXPECTED_MIGRATION_HEAD,
  OPENAPI_AUTHORITY_SHA,
  resolveBackendRoot,
} from "./constants.mjs";
import { repoRoot } from "./paths.mjs";

export function verifyBackendPin() {
  const backendRoot = resolveBackendRoot();
  const backendHead = spawnSync("git", ["-C", backendRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (backendHead.status !== 0) {
    throw new Error(`Could not read backend HEAD: ${backendHead.stderr}`);
  }
  const head = backendHead.stdout.trim();
  if (head !== BACKEND_PIN_SHA) {
    throw new Error(
      `AIEOS360-CX01-I01 BLOCKED — Backend pin drift: HEAD ${head} != ${BACKEND_PIN_SHA}`,
    );
  }
}

export function verifyFrontendOpenApiPins() {
  const openapiPath = join(
    repoRoot,
    "contracts/openapi/aieos-v1.consumer-snapshot.json",
  );
  const digest = createHash("sha256")
    .update(readFileSync(openapiPath))
    .digest("hex")
    .toUpperCase();
  if (digest !== OPENAPI_AUTHORITY_SHA) {
    throw new Error(
      `AIEOS360-CX01-I01 BLOCKED — OpenAPI SHA-256 ${digest} != ${OPENAPI_AUTHORITY_SHA}`,
    );
  }

  const backendRoot = resolveBackendRoot();
  const versionsDir = join(backendRoot, "migrations/versions");
  const files = readdirSync(versionsDir);
  const hasHead = files.some((name) => {
    const path = join(versionsDir, name);
    if (!statSync(path).isFile()) {
      return false;
    }
    const text = readFileSync(path, "utf8");
    return name.includes(EXPECTED_MIGRATION_HEAD) || text.includes(EXPECTED_MIGRATION_HEAD);
  });
  if (!hasHead) {
    throw new Error(
      `AIEOS360-CX01-I01 BLOCKED — Alembic head ${EXPECTED_MIGRATION_HEAD} not found in backend migrations`,
    );
  }
}

export function runPinGuard() {
  verifyBackendPin();
  verifyFrontendOpenApiPins();
}
