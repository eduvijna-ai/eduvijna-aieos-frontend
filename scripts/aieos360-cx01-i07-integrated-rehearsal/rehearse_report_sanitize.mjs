import { PROVIDER_SECRET_ENV_KEYS } from "../aieos360-cx01-i06-showcase-ai-mode/constants.mjs";

const REDACTED = "[REDACTED]";
const URL_WITH_PASSWORD =
  /(postgresql(?:\+\w+)?:\/\/)([^:@/]+):([^@/]+)@/gi;
const BEARER_MARKERS = [
  "aieos360-cx01-i01-showcase-teacher",
  "aieos360-cx01-i01-showcase-principal",
  "aieos360-cx01-i01-showcase-parent",
  "dev-student-a",
  "dev-student-b",
];
const SYNTHETIC_SECRET_VALUE_MARKERS = [
  "sk-synthetic-should-not-leak",
  "sk-leak",
  "secret-pass",
  "still-secret",
];

function redactProviderAssignments(text) {
  let out = text;
  for (const key of PROVIDER_SECRET_ENV_KEYS) {
    const assignment = new RegExp(
      `(${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s*=\\s*[^\\s,;]+`,
      "gi",
    );
    out = out.replace(assignment, `$1=${REDACTED}`);
    out = out.replaceAll(key, REDACTED);
  }
  out = out.replace(/\bsk-[A-Za-z0-9_-]+\b/g, REDACTED);
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, `Bearer ${REDACTED}`);
  return out;
}

export function sanitizeReportString(value) {
  if (value == null) {
    return value;
  }
  let text = String(value);
  text = text.replace(URL_WITH_PASSWORD, `$1$2:${REDACTED}@`);
  for (const marker of BEARER_MARKERS) {
    if (text.includes(marker)) {
      text = text.replaceAll(marker, REDACTED);
    }
  }
  text = redactProviderAssignments(text);
  return text;
}

function findCredentialUrlLeaks(text) {
  const leaks = [];
  const pattern = /(postgresql(?:\+\w+)?:\/\/)([^:@/]+):([^@/]+)@/gi;
  let match = pattern.exec(text);
  while (match) {
    const passwordSegment = match[3];
    if (passwordSegment && passwordSegment !== REDACTED) {
      leaks.push("credential-bearing database URL");
    }
    match = pattern.exec(text);
  }
  return leaks;
}

function findProviderAssignmentLeaks(text) {
  const leaks = [];
  for (const key of PROVIDER_SECRET_ENV_KEYS) {
    const assignment = new RegExp(
      `${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*([^\\s,;]+)`,
      "gi",
    );
    let match = assignment.exec(text);
    while (match) {
      if (match[1] !== REDACTED) {
        leaks.push(`provider secret assignment (${key})`);
      }
      match = assignment.exec(text);
    }
  }
  if (/\bsk-[A-Za-z0-9_-]+\b/.test(text)) {
    leaks.push("api key token (sk-*)");
  }
  for (const marker of SYNTHETIC_SECRET_VALUE_MARKERS) {
    if (text.includes(marker)) {
      leaks.push(`synthetic secret value (${marker})`);
    }
  }
  return leaks;
}

export function scanReportTextForLeaks(text) {
  const leaks = [
    ...findCredentialUrlLeaks(text),
    ...findProviderAssignmentLeaks(text),
  ];
  for (const marker of BEARER_MARKERS) {
    if (text.includes(marker)) {
      leaks.push(`development bearer marker (${marker})`);
    }
  }
  return [...new Set(leaks)];
}

export function toReportSafeFailureMessage(error, fallbackCode) {
  const raw = String(error);
  if (scanReportTextForLeaks(raw).length > 0) {
    return fallbackCode;
  }
  const sanitized = sanitizeReportString(raw);
  if (scanReportTextForLeaks(sanitized).length > 0) {
    return fallbackCode;
  }
  return sanitized;
}

export function sanitizeRehearsalReportPayload(payload) {
  const copy = { ...payload };
  if (copy.failure_reason != null) {
    copy.failure_reason = sanitizeReportString(copy.failure_reason);
    if (scanReportTextForLeaks(copy.failure_reason).length > 0) {
      copy.failure_reason = "rehearsal_failure_sanitized";
    }
  }
  if (Array.isArray(copy.steps)) {
    copy.steps = copy.steps.map((step) => {
      let error = step.error;
      if (error != null) {
        error = sanitizeReportString(error);
        if (scanReportTextForLeaks(error).length > 0) {
          error = "step_error_sanitized";
        }
      }
      return { ...step, error };
    });
  }
  return copy;
}

export function assertSanitizedRehearsalReportPayload(payload) {
  const sanitized = sanitizeRehearsalReportPayload(payload);
  const text = JSON.stringify(sanitized);
  const leaks = scanReportTextForLeaks(text);
  if (leaks.length > 0) {
    throw new Error(`rehearsal report leak scan failed: ${leaks.join(", ")}`);
  }
  return sanitized;
}
