import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { screenshot } from "./stage.ts";

const PAGES = [
  ["/en", "home"],
  ["/en/setup", "setup-guide"],
  ["/en/faq", "faq"],
  ["/en/help", "help"],
  ["/vi", "home-vi"],
  ["/privacy", "privacy"],
  ["/login", "login"],
] as const;

test.describe("public pages, signed out", () => {
  for (const [path, name] of PAGES) {
    test(`${path} renders`, async ({ page }, info) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("main, h1").first()).toBeVisible();
      await screenshot(page, join("public", info.project.name), name);
    });
  }

  test("the dashboard sends a signed-out visitor to the login page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });
});
