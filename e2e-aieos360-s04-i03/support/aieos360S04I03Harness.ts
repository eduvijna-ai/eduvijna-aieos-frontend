import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page, Request } from "@playwright/test";
import { expect } from "@playwright/test";

export const ARCHITECTURE_PIN_SHA =
  "b167bfd951cf9acecb6ff2470ed0fb8c1925097e";
export const FRONTEND_BASE_SHA =
  "20a06f048510a2519e0487d12ea7c16f59e7fd7c";
export const BACKEND_PIN_SHA =
  "637583f42b7c475ef83f6f99bca7e65e665a253d";
export const OPENAPI_AUTHORITY_SHA =
  "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0";
export const EXPECTED_MIGRATION_HEAD = "a360s010004";

export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";
export const DEV_TEACHER_PRINCIPAL_ID =
  "f85329ab-f05b-564e-a67b-318f3e1f3cf3";
export const DEV_STUDENT_A_PRINCIPAL_ID =
  "9d9c5063-28b3-555f-95f1-1265145be7bb";
export const DEV_STUDENT_B_PRINCIPAL_ID =
  "3592cb8e-e421-5277-8753-8506e7a8daf6";
export const DEV_PRINCIPAL_PRINCIPAL_ID =
  "336ffa8c-40ca-50c2-a62a-a40dd0061b55";
export const DEV_PARENT_A_PRINCIPAL_ID =
  "01306aa8-09c8-558f-a777-5c9b6e7b495b";

export const DEV_TEACHER_BEARER_TOKEN = "aieos360-s04-i03-e2e-teacher";
export const DEV_STUDENT_A_BEARER_TOKEN = "dev-student-a";
export const DEV_STUDENT_B_BEARER_TOKEN = "dev-student-b";
export const DEV_PRINCIPAL_BEARER_TOKEN =
  "aieos360-s04-i03-e2e-principal";
export const DEV_PARENT_BEARER_TOKEN = "aieos360-s04-i03-e2e-parent";

export const TEACHER_FRONTEND_URL =
  process.env.AIEOS360_S04_I03_E2E_TEACHER_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_S04_I03_E2E_TEACHER_FRONTEND_PORT || 5281}`;
export const STUDENT_FRONTEND_URL =
  process.env.AIEOS360_S04_I03_E2E_STUDENT_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_S04_I03_E2E_STUDENT_FRONTEND_PORT || 5282}`;
export const PRINCIPAL_FRONTEND_URL =
  process.env.AIEOS360_S04_I03_E2E_PRINCIPAL_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_S04_I03_E2E_PRINCIPAL_FRONTEND_PORT || 5283}`;
export const PARENT_FRONTEND_URL =
  process.env.AIEOS360_S04_I03_E2E_PARENT_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.AIEOS360_S04_I03_E2E_PARENT_FRONTEND_PORT || 5284}`;

export const PARENT_OS_HOME_PATH = "/api/v1/parent-os/home";
export const SCHOOL_INTELLIGENCE_PATH =
  "/api/v1/principal-os/school-intelligence";

export function parentOsChildPath(learnerPrincipalId: string): string {
  return `/api/v1/parent-os/children/${encodeURIComponent(learnerPrincipalId)}`;
}

export type Aieos360S04I03Fixture = {
  scenario_id: string;
  scenario_marker?: string;
  architecture_pin_sha: string;
  frontend_base_sha: string;
  backend_pin_sha: string;
  migration_head: string;
  openapi_authority_sha: string;
  tenant_id: string;
  teacher_principal_id: string;
  student_principal_id: string;
  student_b_principal_id: string;
  principal_principal_id: string;
  parent_principal_id: string;
  parent_kind?: string;
  parent_status?: string;
  principal_kind?: string;
  principal_status?: string;
  parent_capability?: string;
  school_context_provider?: string;
  harness_teacher_authority_map?: unknown;
  harness_student_membership_map?: unknown;
  harness_principal_scope_map?: unknown;
  harness_parent_learner_mapping?: unknown;
  teacher_bearer_token: string;
  student_bearer_token: string;
  student_b_bearer_token: string;
  principal_bearer_token: string;
  parent_bearer_token: string;
  class_ref: string;
  class_ref_5b: string;
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
  shared_database: boolean;
};

export type PersistenceSnapshot = Record<string, unknown>;

let cachedFixture: Aieos360S04I03Fixture | null = null;

export function loadAieos360S04I03Fixture(): Aieos360S04I03Fixture {
  if (cachedFixture) return cachedFixture;
  const fixturePath =
    process.env.AIEOS360_S04_I03_E2E_FIXTURE_PATH ??
    resolve(process.cwd(), "tmp/aieos360-s04-i03-e2e-fixture.json");
  cachedFixture = JSON.parse(
    readFileSync(fixturePath, "utf8"),
  ) as Aieos360S04I03Fixture;

  expect(cachedFixture.architecture_pin_sha).toBe(ARCHITECTURE_PIN_SHA);
  expect(cachedFixture.frontend_base_sha).toBe(FRONTEND_BASE_SHA);
  expect(cachedFixture.backend_pin_sha).toBe(BACKEND_PIN_SHA);
  expect(cachedFixture.openapi_authority_sha).toBe(OPENAPI_AUTHORITY_SHA);
  expect(cachedFixture.migration_head).toBe(EXPECTED_MIGRATION_HEAD);
  expect(cachedFixture.shared_database).toBe(true);
  expect(cachedFixture.school_context_provider).toBe(
    "DevelopmentCoherentSchoolContextProvider",
  );
  for (const key of [
    "harness_teacher_authority_map",
    "harness_student_membership_map",
    "harness_principal_scope_map",
    "harness_parent_learner_mapping",
  ] as const) {
    expect(cachedFixture[key] == null).toBe(true);
  }

  expect(cachedFixture.teacher_principal_id).toBe(DEV_TEACHER_PRINCIPAL_ID);
  expect(cachedFixture.student_principal_id).toBe(
    DEV_STUDENT_A_PRINCIPAL_ID,
  );
  expect(cachedFixture.student_b_principal_id).toBe(
    DEV_STUDENT_B_PRINCIPAL_ID,
  );
  expect(cachedFixture.principal_principal_id).toBe(
    DEV_PRINCIPAL_PRINCIPAL_ID,
  );
  expect(cachedFixture.parent_principal_id).toBe(DEV_PARENT_A_PRINCIPAL_ID);
  expect(cachedFixture.teacher_bearer_token).toBe(DEV_TEACHER_BEARER_TOKEN);
  expect(cachedFixture.student_bearer_token).toBe(
    DEV_STUDENT_A_BEARER_TOKEN,
  );
  expect(cachedFixture.student_b_bearer_token).toBe(
    DEV_STUDENT_B_BEARER_TOKEN,
  );
  expect(cachedFixture.principal_bearer_token).toBe(
    DEV_PRINCIPAL_BEARER_TOKEN,
  );
  expect(cachedFixture.parent_bearer_token).toBe(DEV_PARENT_BEARER_TOKEN);
  return cachedFixture;
}

export function artifactPath(fixture: Aieos360S04I03Fixture): string {
  return `/teacher-os/work/${fixture.work_id}/artifacts/${fixture.content_id}/versions/${fixture.version_id}`;
}

function apiHeaders(
  bearerToken: string,
  extra: Record<string, string> = {},
) {
  return {
    "X-AIEOS-Tenant-ID": loadAieos360S04I03Fixture().tenant_id,
    Authorization: `Bearer ${bearerToken}`,
    ...extra,
  };
}

export function teacherApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360S04I03Fixture();
  return apiHeaders(fixture.teacher_bearer_token, extra);
}

export function studentApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360S04I03Fixture();
  return apiHeaders(fixture.student_bearer_token, extra);
}

export function studentBApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360S04I03Fixture();
  return apiHeaders(fixture.student_b_bearer_token, extra);
}

export function principalApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360S04I03Fixture();
  return apiHeaders(fixture.principal_bearer_token, extra);
}

export function parentApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadAieos360S04I03Fixture();
  return apiHeaders(fixture.parent_bearer_token, extra);
}

async function connectDevSession(
  page: Page,
  tenantId: string,
  bearerToken: string,
) {
  const details = page.locator("details").filter({
    has: page.locator("summary", { hasText: /DEV session/i }),
  });
  await details.evaluate((element) => {
    (element as HTMLDetailsElement).open = true;
  });
  await page.locator('input[name="tenantId"]').fill(tenantId);
  await page.locator('input[name="bearerToken"]').fill(bearerToken);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/Connected \(memory only/i)).toBeVisible();
}

export async function connectTeacherDevSession(page: Page) {
  const fixture = loadAieos360S04I03Fixture();
  if (!page.url().includes("/teacher-os/")) {
    await page.goto(`${TEACHER_FRONTEND_URL}/teacher-os/today`);
  }
  await connectDevSession(page, fixture.tenant_id, fixture.teacher_bearer_token);
}

export async function connectStudentDevSession(page: Page) {
  const fixture = loadAieos360S04I03Fixture();
  if (!page.url().includes("/student-os/")) {
    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/home`);
  }
  await connectDevSession(page, fixture.tenant_id, fixture.student_bearer_token);
}

export async function connectStudentBDevSession(page: Page) {
  const fixture = loadAieos360S04I03Fixture();
  if (!page.url().includes("/student-os/")) {
    await page.goto(`${STUDENT_FRONTEND_URL}/student-os/home`);
  }
  await connectDevSession(
    page,
    fixture.tenant_id,
    fixture.student_b_bearer_token,
  );
}

export async function connectPrincipalDevSession(page: Page) {
  const fixture = loadAieos360S04I03Fixture();
  if (!page.url().includes("/principal-os")) {
    await page.goto(`${PRINCIPAL_FRONTEND_URL}/principal-os`);
  }
  await connectDevSession(
    page,
    fixture.tenant_id,
    fixture.principal_bearer_token,
  );
}

export async function connectParentDevSession(page: Page) {
  const fixture = loadAieos360S04I03Fixture();
  if (!page.url().includes("/parent-os")) {
    await page.goto(`${PARENT_FRONTEND_URL}/parent-os`);
  }
  await connectDevSession(page, fixture.tenant_id, fixture.parent_bearer_token);
}

async function openPage(browser: Browser, baseURL: string): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  return context.newPage();
}

export function openTeacherPage(browser: Browser): Promise<Page> {
  return openPage(browser, TEACHER_FRONTEND_URL);
}

export function openStudentPage(browser: Browser): Promise<Page> {
  return openPage(browser, STUDENT_FRONTEND_URL);
}

export function openPrincipalPage(browser: Browser): Promise<Page> {
  return openPage(browser, PRINCIPAL_FRONTEND_URL);
}

export function openParentPage(browser: Browser): Promise<Page> {
  return openPage(browser, PARENT_FRONTEND_URL);
}

export function assertNoApiMocksInstalled(page: Page) {
  const routes = (page as unknown as { _routes?: unknown[] })._routes;
  if (routes && routes.length > 0) {
    throw new Error(
      "AIEOS360 S04 I03 E2E must not register page.route handlers",
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
  const scriptPath = join(
    resolve(scriptDir, "../../scripts/aieos360-s04-i03-e2e"),
    "persistence_assert.py",
  );
  const backendRoot = resolveBackendRoot();
  const dbReportPath =
    process.env.AIEOS360_S04_I03_E2E_DB_REPORT ??
    resolve(process.cwd(), "tmp/aieos360-s04-i03-e2e-db.json");
  const cliArgs = [scriptPath, "--mode", mode];
  for (const [key, value] of Object.entries(args)) {
    if (value != null) cliArgs.push(`--${key}`, String(value));
  }
  const { VIRTUAL_ENV: _dropVirtualEnv, ...baseEnv } = process.env;
  void _dropVirtualEnv;
  const result = spawnSync(
    process.env.AIEOS360_S04_I03_E2E_UV || "uv",
    ["run", "python", ...cliArgs],
    {
      cwd: backendRoot,
      env: {
        ...baseEnv,
        AIEOS_BACKEND_ROOT: backendRoot,
        AIEOS360_S04_I03_E2E_DB_REPORT: dbReportPath,
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
      `persistence_assert.py ${mode} failed: ${result.stderr || result.stdout}`,
    );
  }
  const jsonLine = (result.stdout || "")
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("{"))
    .at(-1);
  if (!jsonLine) {
    throw new Error(`persistence_assert.py ${mode} produced no JSON`);
  }
  return JSON.parse(jsonLine) as Record<string, unknown>;
}

export function snapshotPersistence(tenantId: string): PersistenceSnapshot {
  return runPersistenceAssert("snapshot-persistence", {
    "tenant-id": tenantId,
    output: resolve(
      process.cwd(),
      "tmp/aieos360-s04-i03-e2e-persistence.json",
    ),
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

function matchingUrl(rawUrl: string, pathname: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    return parsed.pathname === pathname ? parsed : null;
  } catch {
    return null;
  }
}

export function parentHomeUrl(rawUrl: string): URL | null {
  return matchingUrl(rawUrl, PARENT_OS_HOME_PATH);
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
    return parsed.pathname.startsWith("/api/v1/parent-os/children/")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function schoolIntelligenceUrl(rawUrl: string): URL | null {
  return matchingUrl(rawUrl, SCHOOL_INTELLIGENCE_PATH);
}

export function isApiRequest(request: Request): boolean {
  try {
    return new URL(request.url()).pathname.startsWith("/api/");
  } catch {
    return request.url().includes("/api/");
  }
}

export function describeApiRequest(request: Request): string {
  const parsed = new URL(request.url());
  return `${request.method()} ${parsed.pathname}${parsed.search}`;
}

function assertReadTransportOnly(
  request: Request,
  expectedBearer: string,
  forbiddenIds: string[],
) {
  expect(request.method()).toBe("GET");
  expect(new URL(request.url()).search).toBe("");
  expect(request.postData()).toBeNull();
  const headers = request.headers();
  expect(headers.authorization).toBe(`Bearer ${expectedBearer}`);
  for (const id of forbiddenIds) {
    expect(headers.authorization).not.toContain(id);
  }
  for (const headerName of Object.keys(headers)) {
    expect(headerName.toLowerCase()).not.toMatch(/role|capabilit|scope/);
  }
  const headerBlob = JSON.stringify(headers).toLowerCase();
  for (const token of [
    "capability",
    "school scope",
    "class scope",
    "learner entitlement",
    "family relationship",
    "x-aieos-role",
    "x-role",
    "class_ref",
    "teacher_principal",
    "learner_principal",
  ]) {
    expect(headerBlob).not.toContain(token);
  }
}

export function assertParentTransportOnly(
  request: Request,
  fixture: Aieos360S04I03Fixture,
) {
  assertReadTransportOnly(request, fixture.parent_bearer_token, [
    fixture.parent_principal_id,
    fixture.student_principal_id,
    fixture.student_b_principal_id,
  ]);
}

export function assertPrincipalTransportOnly(
  request: Request,
  fixture: Aieos360S04I03Fixture,
) {
  assertReadTransportOnly(request, fixture.principal_bearer_token, [
    fixture.principal_principal_id,
    fixture.teacher_principal_id,
    fixture.student_principal_id,
    fixture.student_b_principal_id,
  ]);
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
