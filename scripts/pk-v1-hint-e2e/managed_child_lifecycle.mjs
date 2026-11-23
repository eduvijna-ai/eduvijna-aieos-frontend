/**
 * Pure + injectable child shutdown decisions for managed pk-v1-hint wrapper.
 */

export const CHILD_TERM_MS = 120_000;

/**
 * @typedef {object} ChildWaitState
 * @property {boolean} closed
 * @property {number|null} exitCode
 * @property {boolean} timedOut
 * @property {boolean} signalSent
 */

/**
 * Plan whether owned PG teardown is safe after a shutdown attempt.
 */
export function allowOwnedDatabaseTeardown({ closed, timedOut }) {
  if (timedOut === true && closed !== true) {
    return false;
  }
  return closed === true;
}

/**
 * Exit code when child did not close before teardown timeout (no DB destruction).
 */
export function timeoutShutdownExitCode(signal) {
  return signal === "SIGINT" ? 130 : 143;
}

/**
 * Wait for child `close`, sending `signal` once. Does not treat `killed` as exit proof.
 * @param {import("node:child_process").ChildProcess|null} child
 * @param {string} signal
 * @param {number} timeoutMs
 * @returns {Promise<ChildWaitState>}
 */
export function waitForChildShutdown(child, signal, timeoutMs = CHILD_TERM_MS) {
  if (!child) {
    return Promise.resolve({
      closed: true,
      exitCode: 1,
      timedOut: false,
      signalSent: false,
    });
  }
  if (child.exitCode !== null) {
    return Promise.resolve({
      closed: true,
      exitCode: child.exitCode,
      timedOut: false,
      signalSent: false,
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    let signalSent = false;

    const finish = (state) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(state);
    };

    const onClose = (code) => {
      finish({
        closed: true,
        exitCode: code ?? 1,
        timedOut: false,
        signalSent,
      });
    };

    child.once("close", onClose);

    const timer = setTimeout(() => {
      if (child.exitCode !== null) {
        onClose(child.exitCode);
        return;
      }
      finish({
        closed: false,
        exitCode: timeoutShutdownExitCode(signal),
        timedOut: true,
        signalSent,
      });
    }, timeoutMs);

    try {
      child.kill(signal);
      signalSent = true;
    } catch {
      finish({
        closed: false,
        exitCode: 1,
        timedOut: false,
        signalSent: false,
      });
    }
  });
}