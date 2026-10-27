import {
  readProcessRegistry,
  verifyRegistryEntry,
} from "../aieos360-cx01-i01r9-showcase-rehearsal/process_group.mjs";

export function countLiveManagedProcesses() {
  const registry = readProcessRegistry();
  let liveCount = 0;
  for (const entry of registry.children ?? []) {
    if (verifyRegistryEntry(entry).ok) {
      liveCount += 1;
    }
  }
  return liveCount;
}

export function verifyOwnedRegistryClear() {
  const liveCount = countLiveManagedProcesses();
  return {
    ok: liveCount === 0,
    liveCount,
  };
}
