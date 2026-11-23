import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const FRONTEND_BASE_SHA =
  "e3a6b4a307edf359a00e027fd50f872751934f5b";
export const BACKEND_PIN_SHA =
  "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa";
export const EXPECTED_MIGRATION_HEAD = "a360s010005";
export const OPENAPI_AUTHORITY_SHA =
  "0061BCF6065FAFA184F196829A87AF98ADEDFCE6B633D45704141A5B48045D22";

export const TEACHER_FRONTEND_URL =
  process.env.PK_V1_HINT_E2E_TEACHER_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.PK_V1_HINT_E2E_TEACHER_FRONTEND_PORT || 5191}`;
export const STUDENT_FRONTEND_URL =
  process.env.PK_V1_HINT_E2E_STUDENT_FRONTEND_URL ||
  `http://127.0.0.1:${process.env.PK_V1_HINT_E2E_STUDENT_FRONTEND_PORT || 5192}`;

export type TeacherRole = "author" | "reviewer" | "publisher";

export type PkV1HintFixture = {
  scenario_id: string;
  backend_pin_sha: string;
  migration_head?: string;
  openapi_authority_sha?: string;
  tenant_id: string;
  author_principal_id: string;
  reviewer_principal_id: string;
  publisher_principal_id: string;
  student_principal_id: string;
  author_bearer_token: string;
  reviewer_bearer_token: string;
  publisher_bearer_token: string;
  student_bearer_token: string;
  class_ref: string;
  work_id: string;
  content_id: string;
  version_id: string;
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

let cachedFixture: PkV1HintFixture | null = null;

export function loadPkV1HintFixture(): PkV1HintFixture {
  if (cachedFixture) return cachedFixture;
  const fixturePath =
    process.env.PK_V1_HINT_E2E_FIXTURE_PATH ??
    resolve(process.cwd(), "tmp/pk-v1-hint-e2e-fixture.json");
  cachedFixture = JSON.parse(readFileSync(fixturePath, "utf8")) as PkV1HintFixture;
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

export function artifactPath(fixture: PkV1HintFixture, versionId?: string) {
  const vid = versionId ?? fixture.version_id;
  return `/teacher-os/work/${fixture.work_id}/artifacts/${fixture.content_id}/versions/${vid}`;
}

export function teacherBearer(role: TeacherRole, fixture: PkV1HintFixture) {
  if (role === "author") return fixture.author_bearer_token;
  if (role === "reviewer") return fixture.reviewer_bearer_token;
  return fixture.publisher_bearer_token;
}

export function teacherApiHeaders(
  role: TeacherRole = "author",
  extra: Record<string, string> = {},
) {
  const fixture = loadPkV1HintFixture();
  return {
    "X-AIEOS-Tenant-ID": fixture.tenant_id,
    Authorization: `Bearer ${teacherBearer(role, fixture)}`,
    ...extra,
  };
}

export function studentApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadPkV1HintFixture();
  return {
    "X-AIEOS-Tenant-ID": fixture.tenant_id,
    Authorization: `Bearer ${fixture.student_bearer_token}`,
    ...extra,
  };
}

async function connectDevSession(
  page: Page,
  surface: "teacher" | "student",
  bearer: string,
) {
  const fixture = loadPkV1HintFixture();
  const home =
    surface === "teacher"
      ? `${TEACHER_FRONTEND_URL}/teacher-os/today`
      : `${STUDENT_FRONTEND_URL}/student-os/home`;
  if (
    (surface === "teacher" && !page.url().includes("/teacher-os/")) ||
    (surface === "student" && !page.url().includes("/student-os/"))
  ) {
    await page.goto(home);
  }
  const details = page.locator("details").filter({
    has: page.locator("summary", { hasText: /DEV session/i }),
  });
  await details.evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await page.locator('input[name="tenantId"]').fill(fixture.tenant_id);
  await page.locator('input[name="bearerToken"]').fill(bearer);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/Connected \(memory only/i)).toBeVisible();
}

export async function connectTeacherRole(page: Page, role: TeacherRole) {
  const fixture = loadPkV1HintFixture();
  await connectDevSession(page, "teacher", teacherBearer(role, fixture));
}

export async function connectStudentDevSession(page: Page) {
  const fixture = loadPkV1HintFixture();
  await connectDevSession(page, "student", fixture.student_bearer_token);
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
    throw new Error("PK-V1-HINT E2E must not register page.route handlers");
  }
}

export function calendarDateOnlyLocal(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function runPersistenceAssert(
  mode: string,
  args: Record<string, string | number | undefined>,
): Record<string, unknown> {
  const scriptDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../scripts/pk-v1-hint-e2e");
  const scriptPath = join(scriptDir, "assert_persistence.py");
  const backendRoot = process.env.AIEOS_BACKEND_ROOT;
  if (!backendRoot) {
    throw new Error("AIEOS_BACKEND_ROOT required for persistence assert");
  }
  const dbReportPath = resolve(process.cwd(), "tmp/pk-v1-hint-e2e-db.json");
  const cliArgs = [scriptPath, "--mode", mode];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    cliArgs.push(`--${key}`, String(value));
  }
  const { VIRTUAL_ENV: _dropVirtualEnv, ...baseEnv } = process.env;
  void _dropVirtualEnv;
  const result = spawnSync(
    process.env.PK_V1_HINT_E2E_UV || "uv",
    ["run", "python", ...cliArgs],
    {
      cwd: backendRoot,
      env: {
        ...baseEnv,
        AIEOS_BACKEND_ROOT: backendRoot,
        PK_V1_HINT_E2E_DB_REPORT: dbReportPath,
        PYTHONPATH: [
          join(backendRoot, "src"),
          backendRoot,
          scriptDir,
        ].join(process.platform === "win32" ? ";" : ":"),
      },
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `assert_persistence ${mode} failed`);
  }
  const lines = (result.stdout || "").trim().split(/\r?\n/);
  const last = lines[lines.length - 1];
  return JSON.parse(last) as Record<string, unknown>;
}

export function runBackendHintProbes(): {
  passed: number;
  failed: number;
  lock_scenarios?: Array<{ scenario_id: string; ok: boolean }>;
} {
  const backendRoot = process.env.AIEOS_BACKEND_ROOT;
  if (!backendRoot) {
    throw new Error("AIEOS_BACKEND_ROOT required for backend probes");
  }
  const dbReportPath = resolve(process.cwd(), "tmp/pk-v1-hint-e2e-db.json");
  const scriptDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../scripts/pk-v1-hint-e2e",
  );
  const scriptPath = join(scriptDir, "run_backend_hint_probes.py");
  const result = spawnSync(
    process.env.PK_V1_HINT_E2E_UV || "uv",
    ["run", "python", scriptPath],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        AIEOS_BACKEND_ROOT: backendRoot,
        PK_V1_HINT_E2E_DB_REPORT: dbReportPath,
        PYTHONPATH: [join(backendRoot, "src"), backendRoot, scriptDir].join(
          process.platform === "win32" ? ";" : ":",
        ),
      },
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "backend probes failed");
  }
  const lines = (result.stdout || "").trim().split(/\r?\n/);
  const last = lines[lines.length - 1];
  return JSON.parse(last) as { passed: number; failed: number };
}