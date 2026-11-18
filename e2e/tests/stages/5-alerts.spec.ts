import { expect } from "@playwright/test";
import { stageTest } from "../stage.ts";

const test = stageTest("alerts");
test.describe("stage alerts: the family PC has been offline for three days", () => {
  test("every dashboard page shows the offline banner", async ({ page, shot }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("alert").filter({ hasText: "has not reported since" })).toContainText("Mia");
    await shot("overview-offline-alert");
    await page.goto("/dashboard/devices");
    await expect(page.getByText("Family PC").first()).toBeVisible();
    await shot("devices-offline");
  });
});
