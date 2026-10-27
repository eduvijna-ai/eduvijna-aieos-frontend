import assert from "node:assert/strict";
import {
  assertSanitizedRehearsalReportPayload,
  sanitizeReportString,
  scanReportTextForLeaks,
} from "./rehearse_report_sanitize.mjs";

const rawFailure =
  "stop failed postgresql://user:secret-pass@localhost/db bearer aieos360-cx01-i01-showcase-teacher OPENAI_API_KEY=sk-leak";
const sanitized = sanitizeReportString(rawFailure);
assert.ok(sanitized.includes("[REDACTED]"));
assert.ok(!sanitized.includes("secret-pass"));
assert.ok(!sanitized.includes("aieos360-cx01-i01-showcase-teacher"));
assert.equal(scanReportTextForLeaks(sanitized).length, 0);

const payload = assertSanitizedRehearsalReportPayload({
  outcome: "fail",
  failure_reason: rawFailure,
  steps: [{ step: "x", status: "fail", error: "dev-student-a tried" }],
  exit_code: 1,
});
assert.ok(JSON.stringify(payload).includes("[REDACTED]"));

console.log("rehearse_report_sanitize.selftest: pass");
