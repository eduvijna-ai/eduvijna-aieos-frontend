import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page, Request, Response } from "@playwright/test";
import { expect } from "@playwright/test";

export const ARCHITECTURE_PIN_SHA =
  "67f4020b78cacdf1716e18d83f4410cb16fdcb4d";
export const FRONTEND_BASE_SHA =
  "04c2b1850732df1b8fe5de55f018edf30365181d";
export const BACKEND_PIN_SHA =
  "138f37bfa7a44c33b206c6b78118154bbb9bc8eb";
export const EXPECTED_MIGRATION_HEAD = "a360s010004";
export const OPENAPI_AUTHORITY_SHA =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";

export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";
export const DEV_TEACHER_PRINCIPAL_ID =
  "f85329ab-f05b-564e-a67b-318f3e1f3cf3";
export const DEV_TEACHER_BEARER_TOKEN = "aieos360-s03-i04-e2e-teacher";
export const DEV_STUDENT_BEARER_TOKEN = "dev-student-a";
export const DEV_PARENT_BEARER_TOKEN = "aieos360-s03-i04-e2e-parent";

export const PARENT_OS_HOME_PATH = "/api/v1/parent-os/home";

export function parentOsChildPath(learnerPrincipalId: string): string {
  return `/api/v1/parent-os/children/${encodeURIComponent(learnerPrincipalId)}`;
}

export const TEACHER_FRONTEND_URL =
  process.env.AIEOS360_S03_I04_E2E_TEACHER_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_S03_I04_E2E_TEACHER_FRONTEND_PORT || 5188}`;
export const STUDENT_FRONTEND_URL =
  process.env.AIEOS360_S03_I04_E2E_STUDENT_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_S03_I04_E2E_STUDENT_FRONTEND_PORT || 5189}`;
export const PARENT_FRONTEND_URL =
  process.env.AIEOS360_S03_I04_E2E_PARENT_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_S03_I04_E2E_PARENT_FRONTEND_PORT || 5190}`;

export type Aieos360S03I04Fixture = {
  scenario_id: string;
  scenario_marker?: string;
  architecture_pin_sha?: string;
  frontend_base_sha?: string;
  backend_pin_sha: string;
  migration_head?: string;
  openapi_authority_sha?: string;
  tenant_id: string;
  teacher_principal_id: string;
  student_principal_id: string;
  student_b_principal_id: string;
  parent_principal_id: string;
  parent_kind?: string;
  parent_status?: string;
  parent_capability?: string;
  harness_parent_learner_mapping?: Record<string, string[]>;
  teacher_bearer_token: string;
  student_bearer_token: string;
  parent_bearer_token: string;
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
  shared_database?: boolean;
};

export type PersistenceSnapshot = Record<string, unknown>;

let cachedFixture: Aieos360S03I04Fixture | null = null;

export function loadAieos360S03I04Fixture(): Aieos360S03I04Fixture {
  if (cachedFixture) return cachedFixture;
  const fixturePath =
    process.env.AIEOS360_S03_I04_E2E_FIXTURE_PATH ??
    resolve(process.cwd(), "tmp/aieos360-s03-i04-e2e-fixture.json");
  cachedFixture = JSON.parse(
    readFileSync(fixturePath, "utf8"),
  ) as Aieos360S03I04Fixture;
  expect(cachedFixture.backend_pin_sha).toBe(BACKEND_PIN_SHA);
  if (cachedFixture.migration_head) {
    expect(cachedFixture.migration_head).toBe(EXPECTED_MIGRATION_HEAD);
  }
  if (cachedFixture.openapi_authority_sha) {
    expect(cachedFixture.openapi_authority_sha).toBe(OPENAPI_AUTHORITY_SHA);
  }
  if (cachedFixture.architecture_pin_sha) {
    expect(cachedFixture.architecture_pin_sha).toBe(ARCHITECTURE_PIN_SHA);
  }
  if (cachedFixture.frontend_base_sha) {
    expect(cachedFixture.frontend_base_sha).toBe(FRONTEND_BASE_SHA);
  }
  expect(cachedFixture.shared_database).toBe(true);
  expect(cachedFixture.parent_kind).toBe("HUMAN");
  expect(cachedFixture.parent_status).toBe("ACTIVE");
  expect(cachedFixture.parent_capability).toBe("parent.intelligence.read");
  expect(cachedFixture.harness_parent_learner_mapping).toEqual({
    [cachedFixture.parent_principal_id]: [cachedFixture.student_principal_id],
  });
  return cachedFixture;
}

export function artifactPath(fixture: Aieos360S03I04Fixture) {
  return `/teacher-os/work/${fixture.work_id}/artifacts/${fixture.content_id}/versions/${fixture.version_id}`;
}

export function teacherApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360S03I04Fixture();
  return {
    "X-AIEOS-Tenant-ID": fixture.tenant_id,
    Authorization: `Bearer ${fixture.teacher_bearer_token || DEV_TEACHER_BEARER_TOKEN}`,
    ...extra,
  };
}

export function studentApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360S03I04Fixture();
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
  const fixture = loadAieos360S03I04Fixture();
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
  const fixture = loadAieos360S03I04Fixture();
  if (!page.url().includes("/student-os/")) {
    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/home`);
  }
  await connectDevSession(
    page,
    fixture.tenant_id,
    fixture.student_bearer_token || DEV_STUDENT_BEARER_TOKEN,
  );
}

export async function connectParentDevSession(page: Page) {
  const fixture = loadAieos360S03I04Fixture();
  if (!page.url().includes("/parent-os")) {
    await page.goto(`${PARENT_FRONTEND_URL}/parent-os`);
  }
  await connectDevSession(
    page,
    fixture.tenant_id,
    fixture.parent_bearer_token || DEV_PARENT_BEARER_TOKEN,
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

export async function openParentPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: PARENT_FRONTEND_URL,
  });
  return context.newPage();
}

export function assertNoApiMocksInstalled(page: Page) {
  const routes = (page as unknown as { _routes?: unknown[] })._routes;
  if (routes && routes.length > 0) {
    throw new Error(
      "AIEOS360 S03 I04 E2E must not register page.route handlers",
    );
  }
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
  const repoScripts = resolve(scriptDir, "../../scripts/aieos360-s03-i04-e2e");
  const scriptPath = join(repoScripts, "assert_persistence.py");
  const backendRoot = resolveBackendRoot();
  const dbReportPath = resolve(
    process.cwd(),
    "tmp/aieos360-s03-i04-e2e-db.json",
  );
  const cliArgs = [scriptPath, "--mode", mode];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    cliArgs.push(`--${key}`, String(value));
  }
  const { VIRTUAL_ENV: _dropVirtualEnv, ...baseEnv } = process.env;
  void _dropVirtualEnv;
  const result = spawnSync(
    process.env.AIEOS360_S03_I04_E2E_UV || "uv",
    ["run", "python", ...cliArgs],
    {
      cwd: backendRoot,
      env: {
        ...baseEnv,
        AIEOS_BACKEND_ROOT: backendRoot,
        AIEOS360_S03_I04_E2E_DB_REPORT: dbReportPath,
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
    "tmp/aieos360-s03-i04-e2e-persistence.json",
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

export function parentHomeUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.pathname === PARENT_OS_HOME_PATH) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function parentChildUrl(
  rawUrl: string,
  learnerPrincipalId?: string,
): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (learnerPrincipalId) {
      return parsed.pathname === parentOsChildPath(learnerPrincipalId)
        ? parsed
        : null;
    }
    if (parsed.pathname.startsWith("/api/v1/parent-os/children/")) {
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

export function assertParentTransportOnly(request: Request, fixture: Aieos360S03I04Fixture) {
  const parsed = new URL(request.url());
  expect(parsed.search).toBe("");
  expect(request.postData()).toBeNull();
  const headers = request.headers();
  const authorization = headers.authorization || headers.Authorization;
  expect(authorization).toBe(
    `Bearer ${fixture.parent_bearer_token || DEV_PARENT_BEARER_TOKEN}`,
  );
  expect(authorization).not.toContain(fixture.parent_principal_id);
  expect(authorization).not.toContain(fixture.student_principal_id);
  const headerBlob = JSON.stringify(headers).toLowerCase();
  expect(headerBlob).not.toContain("learner entitlement");
  expect(headerBlob).not.toContain("capability");
  expect(headerBlob).not.toContain("school scope");
  expect(headerBlob).not.toContain("class scope");
  expect(headerBlob).not.toContain("family relationship");
  expect(headerBlob).not.toContain("x-aieos-role");
  expect(headerBlob).not.toContain("x-role");
  expect(headerBlob).not.toContain("class_ref");
  expect(headerBlob).not.toContain("teacher_principal");
}

export const FORBIDDEN_PARENT_TOKENS = [
  "class_ref",
  "teacher_principal_id",
  "teacher name",
  "teacher_name",
  "teacher notes",
  "teacher_notes",
  "response_snapshot",
  "raw answer",
  "question_id",
  "answer key",
  "attempt_id",
  "submission_id",
  "content_id",
  "content_version_id",
  "evaluation_id",
  "marks",
  "score",
  "grade",
  "correctness",
  "mastery",
  "competency",
  "strengths",
  "weaknesses",
  "risk",
  "prediction",
  "peer comparison",
  "ranking",
  "behind peers",
  "on track",
  "passed",
  "failed",
  "mastered",
  "successful",
  "completed academically",
  "in_scope_class_count",
  "current_policy_evaluation_count",
  "class_result_level",
  "class_result_note",
  "MIXED",
  "remediation",
  "ClassroomAssessment",
  "assignment_lifecycle",
] as const;
