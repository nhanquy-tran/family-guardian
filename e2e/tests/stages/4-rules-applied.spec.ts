import { expect } from "@playwright/test";
import { LEO } from "../../fixtures/scenario.ts";
import { stageTest } from "../stage.ts";

const heading = (name: string | RegExp) => ({ name, level: 1 });

const test = stageTest("rules-applied");
test.describe("stage rules-applied: block rules, daily limit and allowed hours for Leo", () => {
  test("rules page shows blocked sites, limits and hours", async ({ page, shot }) => {
    await page.goto(`/dashboard/children/${LEO}/rules`);
    await expect(page.getByRole("heading", heading("Block sites for Leo"))).toBeVisible();
    await expect(page.getByText("tiktok.com").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Daily limits" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Allowed hours" })).toBeVisible();
    await shot("rules-leo");
  });

  test("usage after the rules", async ({ page, shot }) => {
    await page.goto(`/dashboard/usage/${LEO}`);
    await expect(page.getByRole("heading", heading("Usage"))).toBeVisible();
    await page.getByRole("link", { name: "Week", exact: true }).click();
    await expect(page).toHaveURL(/view=week/);
    await shot("usage-leo-week-after-rules");
  });

  test("homework settings and categories", async ({ page, shot }) => {
    await page.goto(`/dashboard/children/${LEO}/homework`);
    await expect(page.getByText("mathplayground.com").first()).toBeVisible();
    await shot("homework-leo");
    await page.goto("/dashboard/categories");
    await expect(page.getByText("coolmathgames.com").first()).toBeVisible();
    await shot("categories");
  });

  test("overview after the rules", async ({ page, shot }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", heading("Overview"))).toBeVisible();
    await shot("overview-rules");
  });
});
