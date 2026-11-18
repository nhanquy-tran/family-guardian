import { expect } from "@playwright/test";
import { LEO, MIA, TIMEZONE } from "../../fixtures/scenario.ts";
import { expectFocusCard, expectedTrend } from "../expected.ts";
import { stageTest } from "../stage.ts";

const heading = (name: string | RegExp) => ({ name, level: 1 });
const TZ = `tz=${encodeURIComponent(TIMEZONE)}`;

const test = stageTest("rules-applied");
test.describe("stage rules-applied: block rules, daily limit and allowed hours for Leo", () => {
  test("rules page shows the blocked site and category, the games limit and the hours", async ({ page, shot }) => {
    await page.goto(`/dashboard/children/${LEO}/rules`);
    await expect(page.getByRole("heading", heading("Block sites for Leo"))).toBeVisible();
    const rules = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Remove" }) });
    await expect(rules).toHaveCount(2);
    const rule = (kind: string, value: string) =>
      rules.filter({ has: page.getByText(kind, { exact: true }) }).filter({ has: page.getByText(value, { exact: true }) });
    await expect(rule("domain", "tiktok.com")).toHaveCount(1);
    await expect(rule("category", "social")).toHaveCount(1);
    await expect(page.locator('input[name="limit_games"]')).toHaveValue("60");
    await expect(page.locator('input[name="limit_entertainment"]')).toHaveValue("");
    await expect(page.locator('input[name="allowed_start"]')).toHaveValue("07:00");
    await expect(page.locator('input[name="allowed_end"]')).toHaveValue("20:00");
    await shot("rules-leo");
  });

  test("Mia's rules page shows her entertainment limit and no blocks", async ({ page }) => {
    await page.goto(`/dashboard/children/${MIA}/rules`);
    await expect(page.getByText("No sites blocked")).toBeVisible();
    await expect(page.locator('input[name="limit_entertainment"]')).toHaveValue("90");
    await expect(page.locator('input[name="allowed_start"]')).toHaveValue("");
  });

  test("Leo's week after the rules: tiktok.com counts only the time before the block", async ({ page, shot, fixture }) => {
    await page.goto(`/dashboard/usage/${LEO}?${TZ}&view=week`);
    await expect(page.getByRole("heading", heading("Usage"))).toBeVisible();
    // tiktok.com still lists the days before the block; its total is only that time.
    const leoDevices = new Set(fixture.devices.filter((d) => d.child_id === LEO).map((d) => d.id));
    const tiktok = fixture.usage.filter((u) => leoDevices.has(u.device_id) && u.domain === "tiktok.com");
    const minutes = Math.round(tiktok.reduce((s, u) => s + u.seconds, 0) / 60);
    const label = minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min` : `${minutes} min`;
    await expect(page.getByRole("listitem").filter({ has: page.getByText("tiktok.com", { exact: true }) })).toContainText(label);
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

  test("overview after the rules reflects the capped usage", async ({ page, shot, fixture }) => {
    await page.goto(`/dashboard?${TZ}`);
    await expectFocusCard(page, "Leo", expectedTrend(fixture, LEO));
    await expectFocusCard(page, "Mia", expectedTrend(fixture, MIA));
    await shot("overview-rules");
  });
});
