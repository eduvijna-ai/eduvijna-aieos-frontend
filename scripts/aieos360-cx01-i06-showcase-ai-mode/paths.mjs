import { join } from "node:path";
import { repoRoot, tmpDir } from "../aieos360-cx01-i01r9-showcase-rehearsal/paths.mjs";

export { repoRoot, tmpDir };

export const modeConfigPath = join(
  tmpDir,
  "aieos360-cx01-i06-showcase-mode.json",
);

export const runtimeSurfacePath = join(
  repoRoot,
  "public",
  "aieos360-showcase-runtime.json",
);
