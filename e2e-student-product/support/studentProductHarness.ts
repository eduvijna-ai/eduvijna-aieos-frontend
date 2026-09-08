import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const BACKEND_PIN_SHA =
  "921d35eb08890a4e1d86cf95daf9d38cdfc4a13c";
export const EXPECTED_MIGRATION_HEAD = "a360s010002";
export const OPENAPI_AUTHORITY_SHA =
  "4691D6BADA2157D436435BB5CCDD6797EA670D1A87543D42CA39A478F940F330";

export const DEV_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0";
export const DEV_STUDENT_BEARER_TOKEN = "dev-student-a";

export type StudentProductFixture = {
  scenario_id: string;
  backend_pin_sha: string;
  migration_head?: string;
  openapi_authority_sha?: string;
  tenant_id: string;
  student_principal_id: string;
  bearer_token: string;
  assignment_id: string;
  content_id: string;
  content_version_id: string;
  content_type: string;
  worksheet_title: string;
  true_false_question_id: string;
  membership_gate_path: string;
  class_ref: string;
};

let cachedFixture: StudentProductFixture | null = null;

export function loadStudentProductFixture(): StudentProductFixture {
  if (cachedFixture) return cachedFixture;
  const fixturePath =
    process.env.STUDENT_PRODUCT_E2E_FIXTURE_PATH ??
    resolve(process.cwd(), "tmp/student-product-e2e-fixture.json");
  cachedFixture = JSON.parse(
    readFileSync(fixturePath, "utf8"),
  ) as StudentProductFixture;
  expect(cachedFixture.backend_pin_sha).toBe(BACKEND_PIN_SHA);
  if (cachedFixture.migration_head) {
    expect(cachedFixture.migration_head).toBe(EXPECTED_MIGRATION_HEAD);
  }
  if (cachedFixture.openapi_authority_sha) {
    expect(cachedFixture.openapi_authority_sha).toBe(OPENAPI_AUTHORITY_SHA);
  }
  return cachedFixture;
}

export async function connectStudentDevSession(page: Page) {
  const fixture = loadStudentProductFixture();
  if (!page.url().includes("/student-os/")) {
    await page.goto("/student-os/home");
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
    .fill(fixture.bearer_token || DEV_STUDENT_BEARER_TOKEN);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/Connected \(memory only/i)).toBeVisible();
}

export function studentApiHeaders(extra: Record<string, string> = {}) {
  const fixture = loadStudentProductFixture();
  return {
    "X-AIEOS-Tenant-ID": fixture.tenant_id,
    Authorization: `Bearer ${fixture.bearer_token || DEV_STUDENT_BEARER_TOKEN}`,
    ...extra,
  };
}

export function assertNoApiMocksInstalled(page: Page) {
  const routes = (page as unknown as { _routes?: unknown[] })._routes;
  if (routes && routes.length > 0) {
    throw new Error("Student product E2E must not register page.route handlers");
  }
}

export function denyCurrentMembership(fixture: StudentProductFixture) {
  writeFileSync(fixture.membership_gate_path, "denied\n", "utf8");
}

export function allowCurrentMembership(fixture: StudentProductFixture) {
  writeFileSync(fixture.membership_gate_path, "allowed\n", "utf8");
}

export function assertOpaqueCursor(cursor: string | null | undefined) {
  expect(cursor).toBeTruthy();
  expect(typeof cursor).toBe("string");
  // Opaque cursor must not be a bare integer offset / page index.
  expect(cursor).not.toMatch(/^\d+$/);
}
