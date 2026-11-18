import { expect } from "@playwright/test";
import { stageTest } from "../stage.ts";

const test = stageTest("alerts");
test.describe("stage alerts: the family PC has been offline for three days", () => {
  test("overview and devices pages show the offline banner", async ({ page, shot }) => {
    const banner = page.getByRole("alert").filter({ hasText: "has not reported since" });
    await page.goto("/dashboard");
    await expect(banner).toContainText("Mia");
    await shot("overview-offline-alert");
    await page.goto("/dashboard/devices");
    await expect(banner).toContainText("Mia");
    await expect(page.getByText("Family PC").first()).toBeVisible();
    await shot("devices-offline");
  });
});
