export const DEFAULT_ROLE_PORTS = {
  teacher: 5291,
  student: 5292,
  principal: 5293,
  parent: 5294,
} as const;

export const ROLE_ENTRY_PATHS = {
  teacher: "/teacher-os/today",
  student: "/student-os/home",
  principal: "/principal-os",
  parent: "/parent-os",
} as const;

export type ShowcaseRole = keyof typeof ROLE_ENTRY_PATHS;

export type HostParts = {
  protocol: string;
  hostname: string;
};

export type RoleUrlOverrides = Partial<Record<ShowcaseRole, string>>;

const OVERRIDE_ENV_KEYS: Record<ShowcaseRole, keyof ImportMetaEnv> = {
  teacher: "VITE_AIEOS360_SHOWCASE_TEACHER_URL",
  student: "VITE_AIEOS360_SHOWCASE_STUDENT_URL",
  principal: "VITE_AIEOS360_SHOWCASE_PRINCIPAL_URL",
  parent: "VITE_AIEOS360_SHOWCASE_PARENT_URL",
};

const SHOWCASE_ROLES: ShowcaseRole[] = [
  "teacher",
  "student",
  "principal",
  "parent",
];

export function readRoleUrlOverrides(
  env: Pick<ImportMetaEnv, (typeof OVERRIDE_ENV_KEYS)[ShowcaseRole]> = import.meta.env,
): RoleUrlOverrides {
  const overrides: RoleUrlOverrides = {};
  for (const role of SHOWCASE_ROLES) {
    const value = env[OVERRIDE_ENV_KEYS[role]];
    if (typeof value === "string" && value.trim()) {
      overrides[role] = value.trim();
    }
  }
  return overrides;
}

export function buildPortRoleUrl(
  host: HostParts,
  port: number,
  path: string,
): string {
  return `${host.protocol}//${host.hostname}:${port}${path}`;
}

export function buildRoleLaunchUrl(
  role: ShowcaseRole,
  host: HostParts,
  override?: string,
): string {
  if (override) {
    return override;
  }
  return buildPortRoleUrl(
    host,
    DEFAULT_ROLE_PORTS[role],
    ROLE_ENTRY_PATHS[role],
  );
}

export function resolveRoleLaunchUrls(
  host: HostParts,
  overrides: RoleUrlOverrides = readRoleUrlOverrides(),
): Record<ShowcaseRole, string> {
  return {
    teacher: buildRoleLaunchUrl("teacher", host, overrides.teacher),
    student: buildRoleLaunchUrl("student", host, overrides.student),
    principal: buildRoleLaunchUrl("principal", host, overrides.principal),
    parent: buildRoleLaunchUrl("parent", host, overrides.parent),
  };
}

export type StoryStageId =
  | "teacher"
  | "student"
  | "assessment"
  | "improve"
  | "principal"
  | "parent";

export const STORY_STAGE_ORDER: ReadonlyArray<{
  id: StoryStageId;
  label: string;
}> = [
  { id: "teacher", label: "Teacher" },
  { id: "student", label: "Student" },
  { id: "assessment", label: "Assessment" },
  { id: "improve", label: "Improve" },
  { id: "principal", label: "Principal" },
  { id: "parent", label: "Parent" },
];

export function resolveTeacherOsStageUrl(
  host: HostParts,
  path: "/teacher-os/today" | "/teacher-os/assess" | "/teacher-os/improve",
  teacherOverride?: string,
): string {
  if (teacherOverride) {
    try {
      const url = new URL(teacherOverride);
      url.pathname = path;
      return url.toString();
    } catch {
      return buildPortRoleUrl(host, DEFAULT_ROLE_PORTS.teacher, path);
    }
  }
  return buildPortRoleUrl(host, DEFAULT_ROLE_PORTS.teacher, path);
}

export function resolveStoryStageUrl(
  stageId: StoryStageId,
  host: HostParts,
  roleUrls: Record<ShowcaseRole, string>,
  overrides: RoleUrlOverrides = {},
): string {
  switch (stageId) {
    case "teacher":
      return roleUrls.teacher;
    case "student":
      return roleUrls.student;
    case "assessment":
      return resolveTeacherOsStageUrl(
        host,
        "/teacher-os/assess",
        overrides.teacher,
      );
    case "improve":
      return resolveTeacherOsStageUrl(
        host,
        "/teacher-os/improve",
        overrides.teacher,
      );
    case "principal":
      return roleUrls.principal;
    case "parent":
      return roleUrls.parent;
    default: {
      const exhaustive: never = stageId;
      return exhaustive;
    }
  }
}

export function readShowcaseHost(): HostParts {
  return {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
  };
}
