import { readFileSync, readlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

export const CHILD_OWNERSHIP_ENV = "AIEOS360_CX01_I01_SHOWCASE_CHILD_OWNERSHIP";
export const PARENT_RUN_ENV = "AIEOS360_CX01_I01_SHOWCASE_PARENT_RUN_ID";

export function newParentRunId() {
  return randomUUID();
}

export function newChildOwnershipToken() {
  return randomUUID();
}

function readLinuxProcStat(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close === -1) {
      return null;
    }
    const rest = stat.slice(close + 2).split(" ");
    return {
      starttime: rest[19],
      ppid: rest[1],
    };
  } catch {
    return null;
  }
}

function readLinuxEnviron(pid) {
  try {
    return readFileSync(`/proc/${pid}/environ`).toString("utf8");
  } catch {
    return "";
  }
}

function readLinuxExe(pid) {
  try {
    return readlinkSync(`/proc/${pid}/exe`);
  } catch {
    return null;
  }
}

export function captureProcessBirthIdentity(pid) {
  if (!pid || pid <= 0) {
    return null;
  }
  if (process.platform === "linux") {
    const stat = readLinuxProcStat(pid);
    if (!stat) {
      return null;
    }
    return {
      platform: "linux",
      pid,
      ppid: stat.ppid,
      starttime: stat.starttime,
      executable: readLinuxExe(pid),
    };
  }
  if (process.platform === "darwin") {
    const ps = spawnSync("ps", ["-p", String(pid), "-o", "ppid=,lstart="], {
      encoding: "utf8",
    });
    if (ps.status !== 0) {
      return null;
    }
    const line = (ps.stdout || "").trim();
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      return null;
    }
    return {
      platform: "darwin",
      pid,
      ppid: match[1],
      lstart: match[2].trim(),
    };
  }
  if (process.platform === "win32") {
    const ps = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; ` +
          `if($p){"$($p.ParentProcessId)|$($p.CreationDate.ToString('o'))|$($p.ExecutablePath)"}`,
      ],
      { encoding: "utf8" },
    );
    const line = (ps.stdout || "").trim();
    if (!line) {
      return null;
    }
    const [ppid, creationDate, executable] = line.split("|");
    return {
      platform: "win32",
      pid,
      ppid,
      creationDate,
      executable: executable || null,
    };
  }
  return { platform: process.platform, pid };
}

function birthMatches(pid, stored) {
  if (!stored) {
    return false;
  }
  const current = captureProcessBirthIdentity(pid);
  if (!current) {
    return false;
  }
  if (current.platform !== stored.platform) {
    return false;
  }
  // Do not compare ppid: managed/detached children are reparented after the supervisor exits.
  if (current.platform === "linux") {
    return (
      String(current.starttime) === String(stored.starttime) &&
      String(current.pid) === String(stored.pid)
    );
  }
  if (current.platform === "darwin") {
    return current.lstart === stored.lstart && String(current.pid) === String(stored.pid);
  }
  if (current.platform === "win32") {
    return (
      current.creationDate === stored.creationDate &&
      String(current.pid) === String(stored.pid)
    );
  }
  return String(current.pid) === String(stored.pid);
}

function ownershipTokenInProcess(pid, token) {
  if (!token) {
    return false;
  }
  if (process.platform === "linux") {
    const env = readLinuxEnviron(pid);
    return env.includes(`${CHILD_OWNERSHIP_ENV}=${token}`);
  }
  if (process.platform === "darwin") {
    const ps = spawnSync("ps", ["eww", "-p", String(pid)], { encoding: "utf8" });
    return (ps.stdout || "").includes(`${CHILD_OWNERSHIP_ENV}=${token}`);
  }
  if (process.platform === "win32") {
    const ps = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
      ],
      { encoding: "utf8" },
    );
    return (ps.stdout || "").includes(token);
  }
  return false;
}

export function buildChildRegistryEntry({ script, role, pid, parentRunId, ownershipToken }) {
  const birthIdentity = captureProcessBirthIdentity(pid);
  return {
    script,
    role,
    pid,
    parentRunId,
    ownershipToken,
    birthIdentity,
    registeredAt: new Date().toISOString(),
  };
}

export function verifyRegistryEntryOwnership(pid, entry) {
  if (!pid || pid <= 0) {
    return { ok: false, reason: "invalid pid" };
  }
  if (!entry?.ownershipToken || !entry?.birthIdentity) {
    return { ok: false, reason: "registry entry missing ownership metadata" };
  }
  if (String(entry.pid) !== String(pid)) {
    return { ok: false, reason: "registry pid does not match target pid" };
  }
  if (!birthMatches(pid, entry.birthIdentity)) {
    return { ok: false, reason: "process birth identity does not match registry" };
  }
  if (!ownershipTokenInProcess(pid, entry.ownershipToken)) {
    return { ok: false, reason: "ownership token not present in process environment" };
  }
  return { ok: true };
}

/** @deprecated use verifyRegistryEntryOwnership */
export function verifyProcessIdentity(pid, entry) {
  return verifyRegistryEntryOwnership(pid, entry);
}

export async function waitForPidExit(pid, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

export function hashOwnershipRecord(record) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}
