import { expect } from "@playwright/test";
import { LEO, MIA, NOAH, TIMEZONE } from "../../fixtures/scenario.ts";
import { average, expectFocusCard, expectedTrend } from "../expected.ts";
import { stageTest } from "../stage.ts";

const heading = (name: string | RegExp) => ({ name, level: 1 });
const TZ = `tz=${encodeURIComponent(TIMEZONE)}`;

const test = stageTest("week");
test.describe("stage week: seven days of usage, no rules", () => {
  test("overview shows each child's focus score and seven-day trend", async ({ page, shot, fixture }) => {
    await page.goto(`/dashboard?${TZ}`);
    const mia = expectedTrend(fixture, MIA);
    const leo = expectedTrend(fixture, LEO);
    expect(average(mia)).toBeGreaterThan(average(leo) + 20);
    await expectFocusCard(page, "Mia", mia);
    await expectFocusCard(page, "Leo", leo);
    await expectFocusCard(page, "Noah", expectedTrend(fixture, NOAH));
    await shot("overview-week");
  });

  for (const [id, name] of [[MIA, "mia"], [LEO, "leo"], [NOAH, "noah"]] as const) {
    test(`usage page for ${name}`, async ({ page, shot }) => {
      await page.goto(`/dashboard/usage/${id}?${TZ}`);
      await expect(page.getByRole("heading", heading("Usage"))).toBeVisible();
      await shot(`usage-${name}-today`);
      await page.getByRole("link", { name: "Week", exact: true }).click();
      await expect(page).toHaveURL(/view=week/);
      if (id === LEO) {
        for (const site of ["tiktok.com", "instagram.com", "roblox.com"]) await expect(page.getByText(site, { exact: true })).toBeVisible();
      }
      if (id === NOAH) await expect(page.getByText("tiktok.com")).toHaveCount(0);
      await shot(`usage-${name}-week-before-rules`);
    });
  }
});
