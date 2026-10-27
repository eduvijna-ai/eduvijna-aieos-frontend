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
const PROVIDER_MARKERS = [
  "AIEOS_GROQ_API_KEY",
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
];

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
  for (const marker of PROVIDER_MARKERS) {
    if (text.includes(marker)) {
      text = text.replaceAll(marker, REDACTED);
    }
  }
  return text;
}

export function scanReportTextForLeaks(text) {
  const leaks = [];
  if (URL_WITH_PASSWORD.test(text) && !text.includes(REDACTED)) {
    leaks.push("credential-bearing database URL");
  }
  for (const marker of BEARER_MARKERS) {
    if (text.includes(marker)) {
      leaks.push(`development bearer marker (${marker})`);
    }
  }
  for (const marker of PROVIDER_MARKERS) {
    if (text.includes(marker)) {
      leaks.push(`provider secret marker (${marker})`);
    }
  }
  return leaks;
}

export function sanitizeRehearsalReportPayload(payload) {
  const copy = { ...payload };
  if (copy.failure_reason != null) {
    copy.failure_reason = sanitizeReportString(copy.failure_reason);
  }
  if (Array.isArray(copy.steps)) {
    copy.steps = copy.steps.map((step) => ({
      ...step,
      error: step.error != null ? sanitizeReportString(step.error) : step.error,
    }));
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
