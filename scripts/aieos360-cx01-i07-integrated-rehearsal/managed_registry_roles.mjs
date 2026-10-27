/** Frozen I01R9 managed showcase process registry identities (status.mjs). */
export const EXPECTED_MANAGED_PROCESS_ROLES = [
  "teacher-backend",
  "student-backend",
  "principal-backend",
  "parent-backend",
  "teacher_frontend",
  "student_frontend",
  "principal_frontend",
  "parent_frontend",
];

export const CANONICAL_HTTP_ROLES = [
  "teacher",
  "student",
  "principal",
  "parent",
];

/** Maps registry process role → HTTP role_urls key. */
export const REGISTRY_ROLE_TO_HTTP_ROLE = {
  "teacher-backend": "teacher",
  "teacher_frontend": "teacher",
  "student-backend": "student",
  "student_frontend": "student",
  "principal-backend": "principal",
  "principal_frontend": "principal",
  "parent-backend": "parent",
  "parent_frontend": "parent",
};

export function portFromHttpUrl(url) {
  const parsed = new URL(url);
  if (parsed.port) {
    return Number(parsed.port);
  }
  return parsed.protocol === "https:" ? 443 : 80;
}
