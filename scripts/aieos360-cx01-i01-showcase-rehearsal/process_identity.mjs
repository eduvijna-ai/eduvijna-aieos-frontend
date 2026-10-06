import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const OWNER_MARKER = "aieos360-cx01-i01-showcase";

export function processCommandLine(pid) {
  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
      ],
      { encoding: "utf8" },
    );
    return (result.stdout || "").trim();
  }
  try {
    const buf = readFileSync(`/proc/${pid}/cmdline`);
    return buf.toString("utf8").replaceAll("\0", " ").trim();
  } catch {
    return "";
  }
}

export function expectedIdentityForEntry(entry) {
  const script = entry?.script ?? "";
  if (script.startsWith("vite:")) {
    return { kind: "vite", port: script.split(":")[1], marker: OWNER_MARKER };
  }
  if (script.endsWith("-backend.mjs") || script.endsWith("_backend.mjs")) {
    return { kind: "backend", script, marker: OWNER_MARKER };
  }
  if (script.endsWith(".mjs") || script.endsWith(".py")) {
    return { kind: "node", script, marker: OWNER_MARKER };
  }
  return { kind: "unknown", script, marker: OWNER_MARKER };
}

export function verifyProcessIdentity(pid, entry) {
  if (!pid || pid <= 0) {
    return { ok: false, reason: "invalid pid" };
  }
  const cmdline = processCommandLine(pid);
  if (!cmdline) {
    return { ok: false, reason: "could not read process command line" };
  }
  const identity = expectedIdentityForEntry(entry);
  if (identity.kind === "vite") {
    const portOk =
      cmdline.includes("vite") &&
      (cmdline.includes(`--port ${identity.port}`) ||
        cmdline.includes(`--port=${identity.port}`));
    if (!portOk) {
      return { ok: false, reason: "vite command line does not match registry port" };
    }
    return { ok: true, cmdline };
  }
  if (identity.script) {
    const needle = identity.script.replace(/^start-/, "");
    if (
      !cmdline.includes(identity.script) &&
      !cmdline.includes("serve_") &&
      !cmdline.includes(needle)
    ) {
      return {
        ok: false,
        reason: `command line does not match registered script ${identity.script}`,
      };
    }
  }
  if (!cmdline.includes("aieos360-cx01-i01") && !cmdline.includes("cx01")) {
    return { ok: false, reason: "process is not a CX01 showcase child" };
  }
  return { ok: true, cmdline };
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

export function inspectOwnedContainer(containerName) {
  const result = spawnSync(
    "docker",
    ["inspect", "-f", "{{.Id}} {{.Name}}", containerName],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    return { ok: false, error: result.stderr || result.stdout || "docker inspect failed" };
  }
  const line = (result.stdout || "").trim();
  const [id, name] = line.split(/\s+/, 2);
  if (!name?.includes(containerName)) {
    return { ok: false, error: "container name mismatch" };
  }
  return { ok: true, containerId: id, containerName };
}
