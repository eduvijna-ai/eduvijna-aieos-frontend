import { assessHrefForAssignment } from "@/features/teacher-os/assess/assessmentPresentation";
import {
  buildPortRoleUrl,
  DEFAULT_ROLE_PORTS,
  readRoleUrlOverrides,
  readShowcaseHost,
  ROLE_ENTRY_PATHS,
  type HostParts,
  type RoleUrlOverrides,
} from "./roleUrls";
import { withShowcaseAbsoluteUrl } from "./showcaseContext";

function roleBaseUrl(
  role: keyof typeof ROLE_ENTRY_PATHS,
  host: HostParts,
  overrides: RoleUrlOverrides,
): string {
  const override = overrides[role];
  if (override) {
    return override;
  }
  return buildPortRoleUrl(
    host,
    DEFAULT_ROLE_PORTS[role],
    ROLE_ENTRY_PATHS[role],
  );
}

function absolutePathOnRoleBase(baseUrl: string, path: string): string {
  try {
    const url = new URL(baseUrl);
    const [pathname, query = ""] = path.split("?");
    url.pathname = pathname;
    url.search = query;
    url.hash = "";
    return url.toString();
  } catch {
    return path;
  }
}

export function buildStudentAssignmentShowcaseUrl(
  assignmentId: string,
  host: HostParts = readShowcaseHost(),
  overrides: RoleUrlOverrides = readRoleUrlOverrides(),
): string {
  const path = `/student-os/assignments/${encodeURIComponent(assignmentId)}`;
  const base = roleBaseUrl("student", host, overrides);
  if (overrides.student) {
    return withShowcaseAbsoluteUrl(absolutePathOnRoleBase(base, path));
  }
  return withShowcaseAbsoluteUrl(
    buildPortRoleUrl(host, DEFAULT_ROLE_PORTS.student, path),
  );
}

export function buildTeacherAssessShowcaseUrl(
  assignmentId: string,
  host: HostParts = readShowcaseHost(),
  overrides: RoleUrlOverrides = readRoleUrlOverrides(),
): string {
  const path = assessHrefForAssignment(assignmentId);
  const base = roleBaseUrl("teacher", host, overrides);
  if (overrides.teacher) {
    return withShowcaseAbsoluteUrl(absolutePathOnRoleBase(base, path));
  }
  const [pathname, query = ""] = path.split("?");
  const portUrl = buildPortRoleUrl(host, DEFAULT_ROLE_PORTS.teacher, pathname);
  if (!query) {
    return withShowcaseAbsoluteUrl(portUrl);
  }
  const url = new URL(portUrl);
  url.search = query;
  return withShowcaseAbsoluteUrl(url.toString());
}

export function buildPrincipalShowcaseUrl(
  host: HostParts = readShowcaseHost(),
  overrides: RoleUrlOverrides = readRoleUrlOverrides(),
): string {
  const base = roleBaseUrl("principal", host, overrides);
  return withShowcaseAbsoluteUrl(base);
}

export function buildParentShowcaseUrl(
  host: HostParts = readShowcaseHost(),
  overrides: RoleUrlOverrides = readRoleUrlOverrides(),
): string {
  const base = roleBaseUrl("parent", host, overrides);
  return withShowcaseAbsoluteUrl(base);
}
