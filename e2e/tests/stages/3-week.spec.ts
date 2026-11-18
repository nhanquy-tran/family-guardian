import { expect } from "@playwright/test";
import { LEO, MIA, NOAH } from "../../fixtures/scenario.ts";
import { stageTest } from "../stage.ts";

const heading = (name: string | RegExp) => ({ name, level: 1 });

const test = stageTest("week");
test.describe("stage week: seven days of usage, no rules", () => {
  test("overview shows a focus score per child", async ({ page, shot }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "View usage for Mia" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View usage for Leo" })).toBeVisible();
    await shot("overview-week");
  });

  for (const [id, name] of [[MIA, "mia"], [LEO, "leo"], [NOAH, "noah"]] as const) {
    test(`usage page for ${name}`, async ({ page, shot }) => {
      await page.goto(`/dashboard/usage/${id}`);
      await expect(page.getByRole("heading", heading("Usage"))).toBeVisible();
      await shot(`usage-${name}-today`);
      await page.getByRole("link", { name: "Week", exact: true }).click();
      await expect(page).toHaveURL(/view=week/);
      if (id === LEO) await expect(page.getByText("tiktok.com").first()).toBeVisible();
      await shot(`usage-${name}-week-before-rules`);
    });
  }
});
