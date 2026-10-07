#!/usr/bin/env node
import { buildRoleUrls, ROLE_FRONTEND_PATHS } from "./role_urls.mjs";

const urls = buildRoleUrls({
  teacherFe: 5291,
  studentFe: 5292,
  principalFe: 5293,
  parentFe: 5294,
  teacherBe: 8020,
  studentBe: 8021,
  principalBe: 8022,
  parentBe: 8023,
});

const expected = {
  teacher: "/teacher-os/today",
  student: "/student-os/home",
  principal: "/principal-os",
  parent: "/parent-os",
};

for (const [role, path] of Object.entries(expected)) {
  if (!urls[role].frontend.endsWith(path)) {
    console.error(`frontend URL mismatch for ${role}: ${urls[role].frontend}`);
    process.exit(1);
  }
  if (ROLE_FRONTEND_PATHS[role] !== path) {
    console.error(`path constant mismatch for ${role}`);
    process.exit(1);
  }
}

console.log(JSON.stringify({ ok: true, role_frontend_paths: expected }));
