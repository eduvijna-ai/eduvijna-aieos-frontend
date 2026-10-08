#!/usr/bin/env node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { verifyBackendTrackedTreeClean } from "./pin_guard.mjs";

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

function assertThrows(fn, label) {
  try {
    fn();
    console.error(`expected failure: ${label}`);
    process.exit(1);
  } catch {
    /* expected */
  }
}

const repo = mkdtempSync(join(tmpdir(), "cx01-pin-guard-"));
git(repo, ["init", "-q"]);
git(repo, ["config", "user.email", "cx01-selftest@example.com"]);
git(repo, ["config", "user.name", "CX01 Selftest"]);
writeFileSync(join(repo, "tracked.txt"), "v1\n");
git(repo, ["add", "tracked.txt"]);
git(repo, ["commit", "-qm", "init"]);

writeFileSync(join(repo, "local-note.txt"), "benign untracked\n");
verifyBackendTrackedTreeClean(repo);

writeFileSync(join(repo, "tracked.txt"), "v2\n");
assertThrows(
  () => verifyBackendTrackedTreeClean(repo),
  "unstaged tracked modification",
);

git(repo, ["checkout", "--", "tracked.txt"]);
writeFileSync(join(repo, "tracked.txt"), "v3\n");
git(repo, ["add", "tracked.txt"]);
assertThrows(
  () => verifyBackendTrackedTreeClean(repo),
  "staged tracked modification",
);

console.log(
  JSON.stringify({
    ok: true,
    cases: [
      "untracked_file_allowed",
      "unstaged_tracked_rejected",
      "staged_tracked_rejected",
    ],
  }),
);
