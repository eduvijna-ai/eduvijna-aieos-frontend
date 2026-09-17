import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page, Request, Response } from "@playwright/test";
import { expect } from "@playwright/test";

export const FRONTEND_BASE_SHA =
  "4b28e6b499c4593b7d962fe1ed867c2137d43bc7";
export const BACKEND_PIN_SHA =
  "e2bfce86afece6772eaf7c2f1eb18e2dd2240f1b";
export const EXPECTED_MIGRATION_HEAD = "a360s010004";
export const OPENAPI_AUTHORITY_SHA =
  "BE60CC2A4612F77AB333088D264B9501B9AB842995AEC1539DA89EA0E8462B47";

export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";
export const DEV_TEACHER_PRINCIPAL_ID =
  "f85329ab-f05b-564e-a67b-318f3e1f3cf3";
export const DEV_TEACHER_BEARER_TOKEN = "aieos360-s02-i04-e2e-teacher";
export const DEV_STUDENT_BEARER_TOKEN = "dev-student-a";
export const DEV_PRINCIPAL_BEARER_TOKEN = "aieos360-s02-i04-e2e-principal";

export const SCHOOL_INTELLIGENCE_PATH =
  "/api/v1/principal-os/school-intelligence";

export const TEACHER_FRONTEND_URL =
  process.env.AIEOS360_S02_I04_E2E_TEACHER_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_S02_I04_E2E_TEACHER_FRONTEND_PORT || 5185}`;
export const STUDENT_FRONTEND_URL =
  process.env.AIEOS360_S02_I04_E2E_STUDENT_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_S02_I04_E2E_STUDENT_FRONTEND_PORT || 5186}`;
export const PRINCIPAL_FRONTEND_URL =
  process.env.AIEOS360_S02_I04_E2E_PRINCIPAL_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_S02_I04_E2E_PRINCIPAL_FRONTEND_PORT || 5187}`;

export type Aieos360S02I04Fixture = {
  scenario_id: string;
  scenario_marker?: string;
  backend_pin_sha: string;
  migration_head?: string;
  openapi_authority_sha?: string;
  tenant_id: string;
  teacher_principal_id: string;
  student_principal_id: string;
  principal_principal_id: string;
  principal_kind?: string;
  principal_status?: string;
  teacher_bearer_token: string;
  student_bearer_token: string;
  principal_bearer_token: string;
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

export type PersistenceSnapshot = Record<string, unknown>;

let cachedFixture: Aieos360S02I04Fixture | null = null;

export function loadAieos360S02I04Fixture(): Aieos360S02I04Fixture {
  if (cachedFixture) return cachedFixture;
  const fixturePath =
    process.env.AIEOS360_S02_I04_E2E_FIXTURE_PATH ??
    resolve(process.cwd(), "tmp/aieos360-s02-i04-e2e-fixture.json");
  cachedFixture = JSON.parse(
    readFileSync(fixturePath, "utf8"),
  ) as Aieos360S02I04Fixture;
  expect(cachedFixture.backend_pin_sha).toBe(BACKEND_PIN_SHA);
  if (cachedFixture.migration_head) {
    expect(cachedFixture.migration_head).toBe(EXPECTED_MIGRATION_HEAD);
  }
  if (cachedFixture.openapi_authority_sha) {
    expect(cachedFixture.openapi_authority_sha).toBe(OPENAPI_AUTHORITY_SHA);
  }
  expect(cachedFixture.shared_database).toBe(true);
  expect(cachedFixture.principal_kind).toBe("HUMAN");
  expect(cachedFixture.principal_status).toBe("ACTIVE");
  return cachedFixture;
}

export function artifactPath(fixture: Aieos360S02I04Fixture) {
  return `/teacher-os/work/${fixture.work_id}/artifacts/${fixture.content_id}/versions/${fixture.version_id}`;
}

export function teacherApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360S02I04Fixture();
  return {
    "X-AIEOS-Tenant-ID": fixture.tenant_id,
    Authorization: `Bearer ${fixture.teacher_bearer_token || DEV_TEACHER_BEARER_TOKEN}`,
    ...extra,
  };
}

export function studentApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360S02I04Fixture();
  return {
    "X-AIEOS-Tenant-ID": fixture.tenant_id,
    Authorization: `Bearer ${fixture.student_bearer_token || DEV_STUDENT_BEARER_TOKEN}`,
    ...extra,
  };
}

async function connectDevSession(
  page: Page,
  tenantId: string,
  bearerToken: string,
) {
  const details = page.locator("details").filter({
    has: page.locator("summary", { hasText: /DEV session/i }),
  });
  await details.evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await page.locator('input[name="tenantId"]').fill(tenantId);
  await page.locator('input[name="bearerToken"]').fill(bearerToken);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/Connected \(memory only/i)).toBeVisible();
}

export async function connectTeacherDevSession(page: Page) {
  const fixture = loadAieos360S02I04Fixture();
  if (!page.url().includes("/teacher-os/")) {
    await page.goto(`${TEACHER_FRONTEND_URL}/teacher-os/today`);
  }
  await connectDevSession(
    page,
    fixture.tenant_id,
    fixture.teacher_bearer_token || DEV_TEACHER_BEARER_TOKEN,
  );
}

export async function connectStudentDevSession(page: Page) {
  const fixture = loadAieos360S02I04Fixture();
  if (!page.url().includes("/student-os/")) {
    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/home`);
  }
  await connectDevSession(
    page,
    fixture.tenant_id,
    fixture.student_bearer_token || DEV_STUDENT_BEARER_TOKEN,
  );
}

export async function connectPrincipalDevSession(page: Page) {
  const fixture = loadAieos360S02I04Fixture();
  if (!page.url().includes("/principal-os")) {
    await page.goto(`${PRINCIPAL_FRONTEND_URL}/principal-os`);
  }
  await connectDevSession(
    page,
    fixture.tenant_id,
    fixture.principal_bearer_token || DEV_PRINCIPAL_BEARER_TOKEN,
  );
}

export async function openTeacherPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: TEACHER_FRONTEND_URL });
  return context.newPage();
}

export async function openStudentPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: STUDENT_FRONTEND_URL });
  return context.newPage();
}

export async function openPrincipalPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: PRINCIPAL_FRONTEND_URL,
  });
  return context.newPage();
}

export function assertNoApiMocksInstalled(page: Page) {
  const routes = (page as unknown as { _routes?: unknown[] })._routes;
  if (routes && routes.length > 0) {
    throw new Error(
      "AIEOS360 S02 I04 E2E must not register page.route handlers",
    );
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
  const repoScripts = resolve(scriptDir, "../../scripts/aieos360-s02-i04-e2e");
  const scriptPath = join(repoScripts, "assert_persistence.py");
  const backendRoot = resolveBackendRoot();
  const dbReportPath = resolve(
    process.cwd(),
    "tmp/aieos360-s02-i04-e2e-db.json",
  );
  const cliArgs = [scriptPath, "--mode", mode];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    cliArgs.push(`--${key}`, String(value));
  }
  const { VIRTUAL_ENV: _dropVirtualEnv, ...baseEnv } = process.env;
  void _dropVirtualEnv;
  const result = spawnSync(
    process.env.AIEOS360_S02_I04_E2E_UV || "uv",
    ["run", "python", ...cliArgs],
    {
      cwd: backendRoot,
      env: {
        ...baseEnv,
        AIEOS_BACKEND_ROOT: backendRoot,
        AIEOS360_S02_I04_E2E_DB_REPORT: dbReportPath,
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

export function snapshotPersistence(tenantId: string): PersistenceSnapshot {
  const snapshotPath = resolve(
    process.cwd(),
    "tmp/aieos360-s02-i04-e2e-persistence.json",
  );
  return runPersistenceAssert("snapshot-persistence", {
    "tenant-id": tenantId,
    output: snapshotPath,
  });
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

export function schoolIntelligenceUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.pathname === SCHOOL_INTELLIGENCE_PATH) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function isApiRequest(request: Request): boolean {
  try {
    const parsed = new URL(request.url());
    return parsed.pathname.startsWith("/api/");
  } catch {
    return request.url().includes("/api/");
  }
}

export function describeApiRequest(request: Request): string {
  const parsed = new URL(request.url());
  return `${request.method()} ${parsed.pathname}${parsed.search}`;
}

export function describeApiResponse(response: Response): string {
  const parsed = new URL(response.url());
  return `${response.request().method()} ${parsed.pathname}${parsed.search} ${response.status()}`;
}

export const FORBIDDEN_PRINCIPAL_TOKENS = [
  "learner_principal_id",
  "learner name",
  "learner_name",
  "student identity",
  "response_snapshot",
  "raw answer",
  "question outcome",
  "question correctness",
  "objective result",
  "frequently missed",
  "answer key",
  "per-learner score",
  "teacher_principal_id",
  "teacher name",
  "teacher_name",
  "teacher score",
  "teacher rating",
  "teacher rank",
  "teacher leaderboard",
  "best teacher",
  "worst teacher",
  "teacher comparison",
  "disciplinary recommendation",
  "PRIVATE_EXECUTION_NOTE",
  "teacher memory",
  "class_result_level",
  "class_result_note",
  "MIXED",
  "mastery",
  "mastery percentage",
  "competency",
  "learning level",
  "prediction",
  "risk score",
  "performance score",
  "average grade",
  "correctness distribution",
  "heatmap",
  "frequently missed question",
  "objective-level",
] as const;
