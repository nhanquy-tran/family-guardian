import { PairResponse, RulesResponse } from "@fg/shared";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_PAIR_IP } from "../../fixtures/pairing.ts";
import { NOAH, TIMEZONE } from "../../fixtures/scenario.ts";
import { focusCard } from "../expected.ts";
import { stageTest } from "../stage.ts";

const heading = (name: string | RegExp) => ({ name, level: 1 });

const childCard = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });

async function deviceRules(request: APIRequestContext, token: string): Promise<RulesResponse> {
  const response = await request.get("/api/device/rules", { headers: { Authorization: `Bearer ${token}` } });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  return RulesResponse.parse(await response.json());
}

const test = stageTest("onboarded");
const also = (scenario: string) => test.info().annotations.push({ type: "also covers", description: scenario });

test.describe("parent write flows on the onboarded family", () => {
  // Noah starts with no devices; pairing gives the token the later rule checks use.
  test.describe.configure({ mode: "serial" });
  let deviceToken = "";

  test("Valid name is inserted into the parent's family", async ({ page, shot }) => {
    also("Children with controls");
    await page.goto("/dashboard/children");
    await page.getByRole("textbox", { name: "Child's name" }).fill("  Ava  ");
    await page.getByRole("button", { name: "Add child" }).click();
    await expect(page).toHaveURL(/\/dashboard\/children$/);
    const card = childCard(page, "Ava");
    await expect(card).toHaveCount(1);
    await expect(card.getByRole("button", { name: "Pair a device" })).toBeVisible();
    await shot("child-added");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", heading("Overview"))).toBeVisible();
    await expect(focusCard(page, "Ava").getByText("No activity today")).toBeVisible();
    await expect(page.getByRole("link", { name: "View usage for Ava" })).toBeVisible();
    await shot("overview-child-added");
  });

  test("Successful pairing", async ({ page, request, shot }) => {
    also("Active code shown");
    also("Redeem creates a device and consumes the code");
    also("Online and offline devices rendered");
    await page.goto("/dashboard/children");
    const noah = childCard(page, "Noah");
    await noah.getByRole("button", { name: "Pair a device" }).click();
    await expect(noah).toContainText("Valid until");
    const code = (await noah.locator("strong").textContent())?.trim() ?? "";
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    await shot("pairing-code");

    const pair = (body: unknown) =>
      request.post("/api/device/pair", {
        headers: { "Content-Type": "application/json", "X-Forwarded-For": E2E_PAIR_IP },
        data: body,
      });
    const response = await pair({ code: `${code.slice(0, 3)}-${code.slice(3).toLowerCase()}`, browser: "chrome", os: "Windows" });
    expect(response.status()).toBe(200);
    deviceToken = PairResponse.parse(await response.json()).deviceToken;
    expect(deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const reused = await pair({ code, browser: "chrome", os: "Windows" });
    expect(reused.status()).toBe(400);
    expect(await reused.json()).toEqual({ error: "invalid_code" });

    await page.reload();
    await expect(childCard(page, "Noah")).not.toContainText("Valid until");

    await page.goto("/dashboard/devices");
    await expect(page.getByRole("heading", heading("Devices"))).toBeVisible();
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Noah", exact: true }) });
    await expect(section.getByText("Chrome on Windows", { exact: true })).toBeVisible();
    await expect(section.getByText("No devices yet")).toHaveCount(0);
    await shot("device-paired");
  });

  test("Add a domain rule", async ({ page, request, shot }) => {
    also("Valid token returns version and domains");
    also("Rules are listed with remove buttons");
    expect(deviceToken).not.toBe("");
    const before = await deviceRules(request, deviceToken);
    expect(before.domains).toEqual([]);

    await page.goto(`/dashboard/children/${NOAH}/rules`);
    await expect(page.getByRole("heading", heading("Block sites for Noah"))).toBeVisible();
    await expect(page.getByText("No sites blocked")).toBeVisible();
    await page.getByRole("textbox", { name: "Domain to block" }).fill("https://www.TikTok.com/@x");
    await page.getByRole("button", { name: "Block domain" }).click();

    const rules = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Remove" }) });
    await expect(rules).toHaveCount(1);
    await expect(rules.getByText("domain", { exact: true })).toBeVisible();
    await expect(rules.getByText("tiktok.com", { exact: true })).toBeVisible();
    await shot("rule-added");

    const after = await deviceRules(request, deviceToken);
    expect(after.domains).toEqual(["tiktok.com"]);
    expect(after.truncated).toBe(false);
    expect(after.rulesVersion).toBeGreaterThan(before.rulesVersion);
  });

  test("Valid values are upserted", async ({ page, request, shot }) => {
    also("Limits and timezone are returned");
    expect(deviceToken).not.toBe("");
    await page.goto(`/dashboard/children/${NOAH}/rules`);
    const games = page.locator('input[name="limit_games"]');
    await expect(games).toHaveValue("");
    await games.fill("45");
    await page.getByRole("button", { name: "Save limits" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/children/${NOAH}/rules$`));

    await page.reload();
    await expect(page.locator('input[name="limit_games"]')).toHaveValue("45");
    await expect(page.locator('input[name="limit_entertainment"]')).toHaveValue("");
    await shot("limit-saved");

    const rules = await deviceRules(request, deviceToken);
    expect(rules.limits).toEqual([{ category: "games", minutesPerDay: 45 }]);
    expect(rules.timezone).toBe(TIMEZONE);
    expect(rules.domains).toEqual(["tiktok.com"]);
  });
});
