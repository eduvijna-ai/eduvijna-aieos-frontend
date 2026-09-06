import { test, expect } from "@playwright/test";
import {
  apiHeaders,
  assertNoApiMocksInstalled,
  connectDevSession,
  loadProductFixture,
} from "./support/productHarness";

/**
 * TOS-DEV10-I03 Teacher Memory real-stack Product E2E.
 * Zero page.route API mocks — all traffic via Vite /api proxy to FastAPI.
 * Settings → Teaching preferences only (no Teacher Memory primary nav).
 */

test.describe.configure({ mode: "serial" });

type MemoryDto = {
  memory_id: string;
  schema_version: number;
  preferences: {
    teaching_style: string;
    preferred_difficulty: string;
    preparation_detail: string;
    output_format: string;
    include_differentiation: boolean;
  };
  aggregate_revision: number;
};

async function fetchTeacherMemory(page: import("@playwright/test").Page) {
  return page.request.get("/api/v1/teacher-os/memory", {
    headers: apiHeaders(),
  });
}

async function openSettings(page: import("@playwright/test").Page) {
  await page.goto("/teacher-os/settings");
  await connectDevSession(page);
  await expect(
    page.getByRole("heading", { name: "Teaching preferences" }),
  ).toBeVisible();
}

test.describe("TOS-DEV10-I03 Teacher Memory Product E2E", () => {
  test.beforeAll(() => {
    loadProductFixture();
  });

  test.beforeEach(({ page }) => {
    assertNoApiMocksInstalled(page);
  });

  test("Phase A — defaults, save create, reload persistence", async ({
    page,
  }) => {
    assertNoApiMocksInstalled(page);

    const before = await fetchTeacherMemory(page);
    // Fresh principal should have no Memory; tolerate prior local reuse by reset-save later.
    if (before.status() === 404) {
      await openSettings(page);
      await expect(page.getByText(/Not saved yet/i)).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Teaching style" })).toHaveValue(
        "balanced",
      );
      await expect(
        page.getByRole("combobox", { name: "Preferred difficulty" }),
      ).toHaveValue("standard");
      await expect(
        page.getByRole("combobox", { name: "Preparation detail" }),
      ).toHaveValue("balanced");
      await expect(page.getByRole("combobox", { name: "Output format" })).toHaveValue(
        "structured",
      );
      await expect(
        page.getByRole("checkbox", { name: /Include differentiation/i }),
      ).not.toBeChecked();
    } else {
      expect(before.ok()).toBeTruthy();
      await openSettings(page);
      await page.getByRole("button", { name: "Reset to defaults" }).click();
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Teaching preferences saved.")).toBeVisible();
    }

    await page
      .getByRole("combobox", { name: "Teaching style" })
      .selectOption("inquiry_led");
    await page
      .getByRole("combobox", { name: "Preferred difficulty" })
      .selectOption("challenging");
    await page
      .getByRole("combobox", { name: "Preparation detail" })
      .selectOption("detailed");
    await page
      .getByRole("combobox", { name: "Output format" })
      .selectOption("print_friendly");
    await page
      .getByRole("checkbox", { name: /Include differentiation/i })
      .check();

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Teaching preferences saved.")).toBeVisible();

    const durable = await fetchTeacherMemory(page);
    expect(durable.ok()).toBeTruthy();
    const body = (await durable.json()) as MemoryDto;
    expect(body.preferences).toEqual({
      teaching_style: "inquiry_led",
      preferred_difficulty: "challenging",
      preparation_detail: "detailed",
      output_format: "print_friendly",
      include_differentiation: true,
    });

    await page.reload();
    await connectDevSession(page);
    await expect(
      page.getByRole("heading", { name: "Teaching preferences" }),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Teaching style" })).toHaveValue(
      "inquiry_led",
    );
    await expect(
      page.getByRole("combobox", { name: "Preferred difficulty" }),
    ).toHaveValue("challenging");
    await expect(
      page.getByRole("combobox", { name: "Preparation detail" }),
    ).toHaveValue("detailed");
    await expect(page.getByRole("combobox", { name: "Output format" })).toHaveValue(
      "print_friendly",
    );
    await expect(
      page.getByRole("checkbox", { name: /Include differentiation/i }),
    ).toBeChecked();

    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", {
        name: /memory/i,
      }),
    ).toHaveCount(0);
  });

  test("Phase B — change one preference, If-Match save, reload", async ({
    page,
  }) => {
    assertNoApiMocksInstalled(page);
    await openSettings(page);

    await expect(page.getByRole("combobox", { name: "Teaching style" })).toHaveValue(
      "inquiry_led",
    );

    await page
      .getByRole("combobox", { name: "Teaching style" })
      .selectOption("collaborative");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Teaching preferences saved.")).toBeVisible();

    const durable = await fetchTeacherMemory(page);
    expect(durable.ok()).toBeTruthy();
    const body = (await durable.json()) as MemoryDto;
    expect(body.preferences.teaching_style).toBe("collaborative");
    expect(body.preferences.preferred_difficulty).toBe("challenging");
    expect(body.aggregate_revision).toBeGreaterThanOrEqual(1);

    await page.reload();
    await connectDevSession(page);
    await expect(page.getByRole("combobox", { name: "Teaching style" })).toHaveValue(
      "collaborative",
    );
    await expect(
      page.getByRole("combobox", { name: "Preferred difficulty" }),
    ).toHaveValue("challenging");
  });
});
