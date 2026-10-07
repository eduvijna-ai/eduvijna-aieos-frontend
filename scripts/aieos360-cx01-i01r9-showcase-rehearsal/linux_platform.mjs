/** Canonical I01R9 rehearsal runtime is Linux process semantics only. */

const WSL2_MESSAGE =
  "AIEOS360-CX01-I01R9 managed rehearsal commands require Linux (use PowerShell → WSL2 on Windows).";

export function assertLinuxPlatform(command = "managed rehearsal") {
  if (process.platform !== "linux") {
    throw new Error(
      `${WSL2_MESSAGE} (${command} blocked on platform=${process.platform})`,
    );
  }
}

export function failClosedNonLinuxExit(command = "managed rehearsal") {
  try {
    assertLinuxPlatform(command);
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
}
