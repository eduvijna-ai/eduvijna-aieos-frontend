import { test, expect } from "@playwright/test";
import {
  CANONICAL_LABELS,
  CONTENT_IDS,
  TOMORROW,
  VERSION_IDS,
  WORK_ID,
  connectDevSession,
  mockTeachingApis,
} from "./support/teachingWorkHarness";

test.describe("Teacher OS mission → intent → work smoke", () => {
  test("Today → Prepare tomorrow → confirm intent → Work → refine → Continue Work", async ({
    page,
  }) => {
    const seen = await mockTeachingApis(page);
    await connectDevSession(page);

    await expect(
      page.getByRole("heading", { level: 1, name: /Today's Mission/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Nothing is waiting\. Prepare tomorrow's lesson\./i,
      }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /Help me prepare tomorrow/i })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: /Help me prepare tomorrow/i }),
    ).toBeVisible();
    await expect(page.getByText(/DEV placeholder/i)).toHaveCount(0);

    await page
      .getByLabel(/Outcome for this lesson/i)
      .fill("Explain why leaves look green");
    await page.getByRole("button", { name: /Continue to context/i }).click();

    await expect(page.getByLabel(/Lesson date/i)).toHaveValue(TOMORROW);
    await expect(page.getByLabel(/^Locale/i)).toHaveValue("en-IN");
    await page.getByLabel(/^Class \(optional\)/i).fill("Grade 5B");
    await page.getByLabel(/^Subject \(optional\)/i).fill("Science");
    await page.getByLabel(/^Topic \(optional\)/i).fill("Photosynthesis");
    await page.getByRole("button", { name: /Review and confirm/i }).click();

    await expect(page.getByTestId("prepare-summary")).toHaveText(
      `Prepare tomorrow · Grade 5B · Science · Photosynthesis · ${TOMORROW}`,
    );
    await expect(
      page.getByText(/Goal: Explain why leaves look green/i),
    ).toBeVisible();

    await page.getByRole("button", { name: /Create preparation/i }).click();

    await expect(page).toHaveURL(new RegExp(`/teacher-os/work/${WORK_ID}$`));
    await expect(
      page.getByRole("heading", { name: "Photosynthesis" }),
    ).toBeVisible();
    await expect(page.getByText(/Grade 5B/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Create preparation kit/i }),
    ).toBeVisible();
    expect(seen.createKeys).toHaveLength(1);

    await page.getByLabel(/^Topic$/i).fill("Photosynthesis in leaves");
    await page.getByRole("button", { name: /Save changes/i }).click();
    await expect(page.getByText(/Saved\. Your preparation details have been updated/i)).toBeVisible();
    expect(seen.refineKeys).toHaveLength(1);

    await page.getByRole("link", { name: /Today's Mission/i }).click();
    await expect(
      page.getByRole("heading", {
        name: /Continue tomorrow's Photosynthesis in leaves preparation/i,
      }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Continue preparation/i }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher-os/work/${WORK_ID}$`));
    await expect(
      page.getByRole("heading", { name: /Refine this preparation/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/^Topic$/i)).toHaveValue(
      "Photosynthesis in leaves",
    );
  });

  test("Today → Work → Create preparation kit → six artifacts → Review Worksheet → Approve → return to Work → View → Publish → Published", async ({
    page,
  }) => {
    const seen = await mockTeachingApis(page);
    await connectDevSession(page);

    await page
      .getByRole("link", { name: /Help me prepare tomorrow/i })
      .click();
    await page
      .getByLabel(/Outcome for this lesson/i)
      .fill("Explain why leaves look green");
    await page.getByRole("button", { name: /Continue to context/i }).click();
    await page.getByLabel(/^Topic \(optional\)/i).fill("Photosynthesis");
    await page.getByRole("button", { name: /Review and confirm/i }).click();
    await page.getByRole("button", { name: /Create preparation/i }).click();

    await expect(page).toHaveURL(new RegExp(`/teacher-os/work/${WORK_ID}$`));
    await page
      .getByRole("button", { name: /Create preparation kit/i })
      .click();

    await expect(
      page.getByRole("heading", { name: /^Preparation kit$/i }),
    ).toBeVisible();
    for (const label of CANONICAL_LABELS) {
      await expect(
        page.getByRole("heading", { level: 3, name: label }),
      ).toBeVisible();
    }
    expect(seen.prepareKeys).toHaveLength(1);

    await page.getByRole("link", { name: /Review Worksheet/i }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/teacher-os/review/${CONTENT_IDS[1]}/versions/${VERSION_IDS[1]}\\?fromWork=${WORK_ID}$`,
      ),
    );
    await expect(
      page.getByRole("heading", { name: /E2E worksheet draft/i }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();

    await expect(page).toHaveURL(new RegExp(`/teacher-os/work/${WORK_ID}$`));
    const worksheetCard = page
      .locator("article.work-kit-card")
      .filter({ has: page.getByRole("heading", { name: "Worksheet" }) });
    await expect(worksheetCard).toContainText("Approved");
    await expect(
      worksheetCard.getByRole("button", { name: "Publish" }),
    ).toBeVisible();
    await expect(worksheetCard.getByRole("link", { name: "View" })).toBeVisible();

    await worksheetCard.getByRole("link", { name: "View" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/teacher-os/work/${WORK_ID}/artifacts/${CONTENT_IDS[1]}/versions/${VERSION_IDS[1]}$`,
      ),
    );
    await expect(
      page.getByText(/Preview this teaching resource/i),
    ).toBeVisible();
    await expect(page.getByText("Name one part of a leaf")).toBeVisible();
    await expect(page.getByText("The blade is the broad part of the leaf.")).toHaveCount(0);

    await page.getByRole("link", { name: /Back to preparation/i }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher-os/work/${WORK_ID}$`));

    await worksheetCard.getByRole("button", { name: "Publish" }).click();
    await expect(worksheetCard).toContainText("Published");
    await expect(worksheetCard).toHaveAttribute("data-stewardship", "APPROVED");
    await expect(worksheetCard).toHaveAttribute("data-lifecycle", "published");
    await expect(
      worksheetCard.getByRole("button", { name: "Publish" }),
    ).toHaveCount(0);
    expect(seen.publishKeys).toHaveLength(1);

    for (const label of [
      "Lesson Plan",
      "Quick Quiz",
      "Homework",
      "Answer Key",
      "Teacher Notes",
    ]) {
      const other = page
        .locator("article.work-kit-card")
        .filter({ has: page.getByRole("heading", { name: label }) });
      await expect(other).toContainText("In Review");
      await expect(other).not.toContainText("Published");
    }
  });

  test("Prepare offers no generator grid; Work uses Create preparation kit", async ({
    page,
  }) => {
    await mockTeachingApis(page);
    await connectDevSession(page);

    await page
      .getByRole("link", { name: /Help me prepare tomorrow/i })
      .click();
    for (const name of [
      /Generate Worksheet/i,
      /Generate Quiz/i,
      /Generate Lesson Plan/i,
      /Worksheet Generator/i,
    ]) {
      await expect(page.getByRole("button", { name: name })).toHaveCount(0);
      await expect(page.getByRole("link", { name: name })).toHaveCount(0);
    }

    await page
      .getByLabel(/Outcome for this lesson/i)
      .fill("Explain why leaves look green");
    await page.getByRole("button", { name: /Continue to context/i }).click();
    await page.getByRole("button", { name: /Review and confirm/i }).click();
    await page.getByRole("button", { name: /Create preparation/i }).click();

    await expect(
      page.getByRole("button", { name: /Create preparation kit/i }),
    ).toBeVisible();
    await expect(page.getByText(/Worksheet Generator/i)).toHaveCount(0);
  });
});
