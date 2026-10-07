/** Governed role frontend entry paths (must match src/app/router.tsx). */

export const ROLE_FRONTEND_PATHS = {
  teacher: "/teacher-os/today",
  student: "/student-os/home",
  principal: "/principal-os",
  parent: "/parent-os",
};

export function roleFrontendUrl(hostPort, role) {
  const path = ROLE_FRONTEND_PATHS[role];
  if (!path) {
    throw new Error(`unknown role for frontend URL: ${role}`);
  }
  return `http://127.0.0.1:${hostPort}${path}`;
}

export function buildRoleUrls({
  teacherFe,
  studentFe,
  principalFe,
  parentFe,
  teacherBe,
  studentBe,
  principalBe,
  parentBe,
}) {
  return {
    teacher: {
      frontend: roleFrontendUrl(teacherFe, "teacher"),
      backend: `http://127.0.0.1:${teacherBe}`,
    },
    student: {
      frontend: roleFrontendUrl(studentFe, "student"),
      backend: `http://127.0.0.1:${studentBe}`,
    },
    principal: {
      frontend: roleFrontendUrl(principalFe, "principal"),
      backend: `http://127.0.0.1:${principalBe}`,
    },
    parent: {
      frontend: roleFrontendUrl(parentFe, "parent"),
      backend: `http://127.0.0.1:${parentBe}`,
    },
  };
}

export function buildReadinessTargets(roleUrls) {
  return Object.entries(roleUrls).map(([role, urls]) => ({
    role,
    backend: `${urls.backend.replace(/\/$/, "")}/docs`,
    frontend: urls.frontend,
  }));
}
