import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const FRONTEND_BASE_SHA =
  "fb5c0f9ae4cb45c8d7876662abdd2e852e318c56";
export const BACKEND_PIN_SHA =
  "3d25bb2d7ae3a6a95affdf075a75f20db48a6959";
export const EXPECTED_MIGRATION_HEAD = "a360s010004";
export const OPENAPI_AUTHORITY_SHA =
  "7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB";

export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";
export const DEV_TEACHER_PRINCIPAL_ID =
  "f85329ab-f05b-564e-a67b-318f3e1f3cf3";
export const DEV_TEACHER_BEARER_TOKEN = "aieos360-i05-e2e-teacher";
export const DEV_STUDENT_BEARER_TOKEN = "dev-student-a";

export const TEACHER_FRONTEND_URL =
  process.env.AIEOS360_I05_E2E_TEACHER_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_I05_E2E_TEACHER_FRONTEND_PORT || 5183}`;
export const STUDENT_FRONTEND_URL =
  process.env.AIEOS360_I05_E2E_STUDENT_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_I05_E2E_STUDENT_FRONTEND_PORT || 5184}`;

export type Aieos360I05Fixture = {
  scenario_id: string;
  scenario_marker?: string;
  backend_pin_sha: string;
  migration_head?: string;
  openapi_authority_sha?: string;
  tenant_id: string;
  teacher_principal_id: string;
  student_principal_id: string;
  teacher_bearer_token: string;
  student_bearer_token: string;
  class_ref: string;
  work_id: string;
  content_id: string;
  version_id: string;
  content_type: string;
  worksheet_title: string;
  q_correct_id: string;
  q_incorrect_id: string;
  q_unanswered_id: string;
  q_open_id: string;
  obj_demonstrated_id: string;
  obj_not_yet_id: string;
  obj_insufficient_id: string;
  evaluation_policy_id: string;
  evaluation_policy_version: number;
  shared_database?: boolean;
};

let cachedFixture: Aieos360I05Fixture | null = null;

export function loadAieos360I05Fixture(): Aieos360I05Fixture {
  if (cachedFixture) return cachedFixture;
  const fixturePath =
    process.env.AIEOS360_I05_E2E_FIXTURE_PATH ??
    resolve(process.cwd(), "tmp/aieos360-i05-e2e-fixture.json");
  cachedFixture = JSON.parse(
    readFileSync(fixturePath, "utf8"),
  ) as Aieos360I05Fixture;
  expect(cachedFixture.backend_pin_sha).toBe(BACKEND_PIN_SHA);
  if (cachedFixture.migration_head) {
    expect(cachedFixture.migration_head).toBe(EXPECTED_MIGRATION_HEAD);
  }
  if (cachedFixture.openapi_authority_sha) {
    expect(cachedFixture.openapi_authority_sha).toBe(OPENAPI_AUTHORITY_SHA);
  }
  expect(cachedFixture.shared_database).toBe(true);
  return cachedFixture;
}

export function artifactPath(fixture: Aieos360I05Fixture) {
  return `/teacher-os/work/${fixture.work_id}/artifacts/${fixture.content_id}/versions/${fixture.version_id}`;
}

export function teacherApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360I05Fixture();
  return {
    "X-AIEOS-Tenant-ID": fixture.tenant_id,
    Authorization: `Bearer ${fixture.teacher_bearer_token || DEV_TEACHER_BEARER_TOKEN}`,
    ...extra,
  };
}

export function studentApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360I05Fixture();
  return {
    "X-AIEOS-Tenant-ID": fixture.tenant_id,
    Authorization: `Bearer ${fixture.student_bearer_token || DEV_STUDENT_BEARER_TOKEN}`,
    ...extra,
  };
}

export async function connectTeacherDevSession(page: Page) {
  const fixture = loadAieos360I05Fixture();
  if (!page.url().includes("/teacher-os/")) {
    await page.goto(`${TEACHER_FRONTEND_URL}/teacher-os/today`);
  }
  const details = page.locator("details").filter({
    has: page.locator("summary", { hasText: /DEV session/i }),
  });
  await details.evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await page.locator('input[name="tenantId"]').fill(fixture.tenant_id);
  await page
    .locator('input[name="bearerToken"]')
    .fill(fixture.teacher_bearer_token || DEV_TEACHER_BEARER_TOKEN);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/Connected \(memory only/i)).toBeVisible();
}

export async function connectStudentDevSession(page: Page) {
  const fixture = loadAieos360I05Fixture();
  if (!page.url().includes("/student-os/")) {
    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/home`);
  }
  const details = page.locator("details").filter({
    has: page.locator("summary", { hasText: /DEV session/i }),
  });
  await details.evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await page.locator('input[name="tenantId"]').fill(fixture.tenant_id);
  await page
    .locator('input[name="bearerToken"]')
    .fill(fixture.student_bearer_token || DEV_STUDENT_BEARER_TOKEN);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/Connected \(memory only/i)).toBeVisible();
}

export async function openTeacherPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: TEACHER_FRONTEND_URL });
  return context.newPage();
}

export async function openStudentPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: STUDENT_FRONTEND_URL });
  return context.newPage();
}

export function assertNoApiMocksInstalled(page: Page) {
  const routes = (page as unknown as { _routes?: unknown[] })._routes;
  if (routes && routes.length > 0) {
    throw new Error("AIEOS360 I05 E2E must not register page.route handlers");
  }
}

export function calendarDateOnlyLocal(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function resolveBackendRoot(): string {
  const root = process.env.AIEOS_BACKEND_ROOT;
  if (!root) {
    throw new Error("AIEOS_BACKEND_ROOT is required for persistence assertions");
  }
  return root;
}

export function runPersistenceAssert(
  mode: string,
  args: Record<string, string | number | undefined>,
): Record<string, unknown> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoScripts = resolve(scriptDir, "../../scripts/aieos360-i05-e2e");
  const scriptPath = join(repoScripts, "assert_persistence.py");
  const backendRoot = resolveBackendRoot();
  const dbReportPath = resolve(process.cwd(), "tmp/aieos360-i05-e2e-db.json");
  const cliArgs = [scriptPath, "--mode", mode];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    cliArgs.push(`--${key}`, String(value));
  }
  const { VIRTUAL_ENV: _dropVirtualEnv, ...baseEnv } = process.env;
  void _dropVirtualEnv;
  const result = spawnSync(
    process.env.AIEOS360_I05_E2E_UV || "uv",
    ["run", "python", ...cliArgs],
    {
      cwd: backendRoot,
      env: {
        ...baseEnv,
        AIEOS_BACKEND_ROOT: backendRoot,
        AIEOS360_I05_E2E_DB_REPORT: dbReportPath,
        PYTHONPATH: [join(backendRoot, "src"), backendRoot].join(
          process.platform === "win32" ? ";" : ":",
        ),
      },
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `assert_persistence.py ${mode} failed: ${result.stderr || result.stdout}`,
    );
  }
  const lines = (result.stdout || "")
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("{"));
  const last = lines[lines.length - 1];
  if (!last) {
    throw new Error(`assert_persistence.py ${mode} produced no JSON`);
  }
  return JSON.parse(last) as Record<string, unknown>;
}

export async function fetchTeachingAssignment(page: Page, assignmentId: string) {
  const response = await page.request.get(
    `/api/v1/teaching/assignments/${assignmentId}`,
    { headers: teacherApiHeaders() },
  );
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{
    assignment_id: string;
    audience_type: string;
    class_ref: string;
    content_id: string;
    content_version_id: string;
    lifecycle_state: string;
    teacher_principal_id: string;
    source_work_id: string | null;
  }>;
}

export async function listClassroomAssessments(
  page: Page,
  params: { assignmentId?: string; limit?: number } = {},
) {
  const search = new URLSearchParams();
  if (params.assignmentId) search.set("assignment_id", params.assignmentId);
  if (params.limit) search.set("limit", String(params.limit));
  const response = await page.request.get(
    `/api/v1/assessment/classroom-assessments?${search.toString()}`,
    { headers: teacherApiHeaders() },
  );
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    items: Array<Record<string, unknown>>;
  };
  return body.items;
}

export async function fetchTeachingWork(page: Page, workId: string) {
  const response = await page.request.get(`/api/v1/teaching/works/${workId}`, {
    headers: teacherApiHeaders(),
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{
    work_id: string;
    intent_type: string;
    goal_text: string;
  }>;
}

export async function listTeachingWorkArtifacts(page: Page, workId: string) {
  const response = await page.request.get(
    `/api/v1/teaching/works/${workId}/artifacts`,
    { headers: teacherApiHeaders() },
  );
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{
    work_id: string;
    items: unknown[];
  }>;
}
