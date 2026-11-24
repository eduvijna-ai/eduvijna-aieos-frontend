/**
 * Pure + injectable child shutdown decisions for managed pk-v1-hint wrapper.
 * PG teardown is allowed only after an observed ChildProcess `close` event.
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
  if (timedOut === true) {
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
 * Wait for child `close`, sending `signal` once. Never treats `exitCode` alone as close.
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

  return new Promise((resolve) => {
    let settled = false;
    let signalSent = false;
    let resolvedExit = null;

    const finish = (state) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(state);
    };

    child.once("close", (code) => {
      resolvedExit = code ?? 1;
      finish({
        closed: true,
        exitCode: resolvedExit,
        timedOut: false,
        signalSent,
      });
    });

    child.once("error", () => {
      finish({
        closed: false,
        exitCode: 1,
        timedOut: false,
        signalSent,
      });
    });

    const timer = setTimeout(() => {
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
      clearTimeout(timer);
      finish({
        closed: false,
        exitCode: 1,
        timedOut: false,
        signalSent: false,
      });
    }
  });
}