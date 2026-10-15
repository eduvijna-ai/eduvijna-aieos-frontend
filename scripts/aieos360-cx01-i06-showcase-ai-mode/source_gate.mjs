import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  EXPECTED_MIGRATION_HEAD,
  GOVERNED_SOURCE_REFS,
  OPENAPI_AUTHORITY_SHA,
} from "./constants.mjs";
import { repoRoot } from "./paths.mjs";

function remoteMainSha(repo) {
  const result = spawnSync(
    "git",
    ["ls-remote", `https://github.com/${repo}.git`, "refs/heads/main"],
    { encoding: "utf8" },
  );
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`Could not resolve origin/main for ${repo}: ${result.stderr}`);
  }
  const line = result.stdout.trim().split("\n")[0];
  const sha = line.split("\t")[0]?.trim();
  if (!sha) {
    throw new Error(`Malformed ls-remote output for ${repo}`);
  }
  return sha;
}

export function verifyGovernedFiveRepoRefs() {
  const evidence = {};
  for (const [name, { repo, sha }] of Object.entries(GOVERNED_SOURCE_REFS)) {
    const actual = remoteMainSha(repo);
    evidence[name] = { expected: sha, actual, repo };
    if (actual !== sha) {
      const mismatch = { name, expected: sha, actual, repo };
      throw new Error(
        `AIEOS360-CX01-I06 AUTHORIZATION EXPIRED — SOURCE MOVED (${JSON.stringify(mismatch)})`,
      );
    }
  }
  return evidence;
}

export function verifyOpenApiSnapshotSha() {
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
      `OpenAPI SHA-256 ${digest} != governed ${OPENAPI_AUTHORITY_SHA}`,
    );
  }
  return digest;
}

export function verifyAlembicHeadMarker(backendRoot) {
  const versionsDir = join(backendRoot, "migrations/versions");
  const files = readdirSync(versionsDir);
  const hasHead = files.some((name) => {
    const path = join(versionsDir, name);
    if (!statSync(path).isFile()) {
      return false;
    }
    const text = readFileSync(path, "utf8");
    return (
      name.includes(EXPECTED_MIGRATION_HEAD) ||
      text.includes(EXPECTED_MIGRATION_HEAD)
    );
  });
  if (!hasHead) {
    throw new Error(
      `Alembic head ${EXPECTED_MIGRATION_HEAD} not found under ${versionsDir}`,
    );
  }
}
