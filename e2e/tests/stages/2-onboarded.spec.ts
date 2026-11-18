import { expect } from "@playwright/test";
import { focusCard } from "../expected.ts";
import { stageTest } from "../stage.ts";

const heading = (name: string | RegExp) => ({ name, level: 1 });

const test = stageTest("onboarded");
test.describe("stage onboarded: children and devices, no usage yet", () => {
  test("children list shows all three children", async ({ page, shot }) => {
    await page.goto("/dashboard/children");
    for (const name of ["Mia", "Leo", "Noah"]) await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    await shot("children");
  });

  test("devices page lists the paired devices", async ({ page, shot }) => {
    await page.goto("/dashboard/devices");
    await expect(page.getByRole("heading", heading("Devices"))).toBeVisible();
    for (const name of ["Mia's laptop", "Family PC", "Leo's laptop"]) await expect(page.getByText(name).first()).toBeVisible();
    await shot("devices-online");
  });

  test("overview has no focus data yet", async ({ page, shot }) => {
    await page.goto("/dashboard");
    for (const name of ["Mia", "Leo", "Noah"]) {
      const card = focusCard(page, name);
      await expect(card.getByText("No activity today")).toBeVisible();
      await expect(card.getByRole("list", { name: "Last 7 days" }).getByText("no data")).toHaveCount(7);
    }
    await shot("overview-no-usage");
  });
});
