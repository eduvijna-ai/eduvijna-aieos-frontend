#!/usr/bin/env node
/**
 * Operator-only showcase mode configuration (NON_PRODUCTION).
 * Must run while the managed stack is stopped.
 */
import { readFileSync, existsSync } from "node:fs";
import { statusPath } from "../aieos360-cx01-i01r9-showcase-rehearsal/paths.mjs";
import {
  assertModeChangeAllowed,
  buildModeConfigRecord,
  persistModeConfig,
  readSelectedShowcaseMode,
  resolveShowcaseModeForStart,
} from "./mode.mjs";
import { readProcessRegistry, verifyRegistryEntry } from "../aieos360-cx01-i01r9-showcase-rehearsal/process_group.mjs";

const operatorStatus = existsSync(statusPath)
  ? JSON.parse(readFileSync(statusPath, "utf8"))
  : null;
const registry = readProcessRegistry();
const liveCount = (registry.children ?? []).filter(
  (entry) => verifyRegistryEntry(entry).ok,
).length;

try {
  assertModeChangeAllowed(operatorStatus, liveCount);
  const resolved = resolveShowcaseModeForStart();
  const record = buildModeConfigRecord(resolved);
  persistModeConfig(record);
  console.log(
    JSON.stringify(
      {
        configured: true,
        selected_mode: record.selected_mode,
        operator_env_key: "AIEOS360_CX01_I06_SHOWCASE_MODE",
        current_env_mode: readSelectedShowcaseMode(),
        persisted_path: "tmp/aieos360-cx01-i06-showcase-mode.json",
        note:
          "Set mode via operator shell env before start; restart required to apply changes.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify({ configured: false, error: String(error) }, null, 2));
  process.exit(1);
}
