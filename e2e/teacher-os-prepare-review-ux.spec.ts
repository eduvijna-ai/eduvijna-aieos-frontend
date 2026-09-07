import { test, expect, type Page } from "@playwright/test";
import {
  CANONICAL_LABELS,
  CONTENT_IDS,
  VERSION_IDS,
  WORK_ID,
  connectDevSession,
  mockTeachingApis,
} from "./support/teachingWorkHarness";

async function createPreparationKit(page: Page) {
  await page.getByRole("link", { name: /Help me prepare tomorrow/i }).click();
  await page
    .getByLabel(/Outcome for this lesson/i)
    .fill("Explain why leaves look green");
  await page.getByRole("button", { name: /Continue to context/i }).click();
  await page.getByLabel(/^Topic \(optional\)/i).fill("Photosynthesis");
  await page.getByRole("button", { name: /Review and confirm/i }).click();
  await page.getByRole("button", { name: /Create preparation/i }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher-os/work/${WORK_ID}$`));
  await page.getByRole("button", { name: /Create preparation kit/i }).click();
  await expect(
    page.getByRole("heading", { name: /^Preparation kit$/i }),
  ).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflowed = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  expect(overflowed).toBeFalsy();
}

test.describe("TOS-CX01-I02 Prepare and Review UX", () => {
  test("Preparation kit is readable at desktop, 1024, and 768 widths", async ({
    page,
  }) => {
    await mockTeachingApis(page);
    await connectDevSession(page);
    await createPreparationKit(page);

    for (const width of [1440, 1024, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const label of CANONICAL_LABELS) {
        await expect(
          page.getByRole("heading", { level: 3, name: label }),
        ).toBeVisible();
      }
      await expect(page.getByText(/age_appropriate/i)).toHaveCount(0);
      await expect(page.getByText(/ETag/i)).toHaveCount(0);
      await assertNoHorizontalOverflow(page);
    }
  });

  test("quality details disclose human labels and wrap long explanations", async ({
    page,
  }) => {
    await mockTeachingApis(page);
    await connectDevSession(page);
    await createPreparationKit(page);

    const worksheet = page
      .locator("article.work-kit-card")
      .filter({ has: page.getByRole("heading", { name: "Worksheet" }) });
    await expect(worksheet.getByText(/quality check/i)).toBeVisible();
    await expect(worksheet.getByText(/age_appropriate/i)).toHaveCount(0);
    await worksheet.getByText("View quality details").click();
    await expect(worksheet.getByText("Age appropriate")).toBeVisible();
    await expect(
      worksheet.locator(".work-eq-explanation"),
    ).toContainText("QualityExplanationMustWrapAcrossTheCard");
    await assertNoHorizontalOverflow(page);
  });

  test("Work → Review Worksheet shows the document, not JSON, then Approve returns", async ({
    page,
  }) => {
    await mockTeachingApis(page);
    await connectDevSession(page);
    await createPreparationKit(page);

    await page.getByRole("link", { name: /Review Worksheet/i }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/teacher-os/review/${CONTENT_IDS[1]}/versions/${VERSION_IDS[1]}\\?fromWork=${WORK_ID}$`,
      ),
    );
    await expect(
      page.getByRole("heading", { name: "Review Worksheet" }),
    ).toBeVisible();
    await expect(page.getByText("Name one part of a leaf")).toBeVisible();
    await expect(page.getByText(/"prompt"/)).toHaveCount(0);
    await expect(page.locator(".safe-json-payload")).toHaveCount(0);
    await expect(page.getByText(/schema_id/i)).toHaveCount(0);
    await expect(page.getByText(/\bETag\b/i)).toHaveCount(0);
    await expect(page.getByText(/Aggregate revision/i)).toHaveCount(0);

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher-os/work/${WORK_ID}$`));
    const worksheetCard = page
      .locator("article.work-kit-card")
      .filter({ has: page.getByRole("heading", { name: "Worksheet" }) });
    await expect(worksheetCard).toContainText("Approved");
  });

  test("Request changes requires a comment; reject requires confirmation", async ({
    page,
  }) => {
    await mockTeachingApis(page);
    await connectDevSession(page);
    await createPreparationKit(page);

    await page.getByRole("link", { name: /Review Quick Quiz/i }).click();
    await page.getByRole("button", { name: "Request changes" }).click();
    await page.getByRole("button", { name: /Send change request/i }).click();
    await expect(page).toHaveURL(/\/teacher-os\/review\//);
    await page
      .getByLabel(/What should be changed/i)
      .fill("Please strengthen the questions.");
    await page.getByRole("button", { name: /Send change request/i }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher-os/work/${WORK_ID}$`));

    await page.getByRole("link", { name: /Review Homework/i }).click();
    await page.getByRole("button", { name: "Reject" }).click();
    const confirm = page.getByRole("button", { name: /Reject this resource/i });
    await expect(confirm).toBeDisabled();
    await page
      .getByLabel(/I understand this resource will be rejected/i)
      .check();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page).toHaveURL(new RegExp(`/teacher-os/work/${WORK_ID}$`));
  });
});
