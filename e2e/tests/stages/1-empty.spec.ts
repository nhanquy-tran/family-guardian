import { expect } from "@playwright/test";
import { stageTest } from "../stage.ts";

const heading = (name: string | RegExp) => ({ name, level: 1 });

const test = stageTest("empty");
test.describe("stage empty: parent signed in, nothing set up", () => {
  test("overview invites the parent to add a child", async ({ page, shot }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", heading("Overview"))).toBeVisible();
    await expect(page.getByText("No children yet.")).toBeVisible();
    await shot("overview-empty");
  });

  test("children, install and settings pages", async ({ page, shot }) => {
    for (const [path, name] of [["/dashboard/children", "children-empty"], ["/dashboard/install", "install"], ["/dashboard/settings", "settings"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await shot(name);
    }
  });
});
