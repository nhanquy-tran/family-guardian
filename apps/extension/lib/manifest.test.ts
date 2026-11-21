import { describe, expect, it } from "vitest";
import { FIREFOX_ADDON_ID, FIREFOX_UPDATE_URL } from "@fg/shared";
import { buildFirefoxManifest, buildManifest, FIREFOX_MANIFEST_VERSION } from "./manifest";
import chromiumFixture from "./fixtures/chromium-manifest.json";

const ORIGIN = "https://fg.example";
const asRecord = (value: unknown) => value as Record<string, unknown>;

function effective(manifest: Record<string, unknown>): string[] {
  const list = (key: string) => (Array.isArray(manifest[key]) ? (manifest[key] as string[]) : []);
  return [...list("permissions"), ...list("host_permissions")].sort();
}

describe("buildFirefoxManifest", () => {
  it("Gecko identity and data declaration", () => {
    const gecko = asRecord(asRecord(buildFirefoxManifest(ORIGIN))["browser_specific_settings"])["gecko"] as Record<string, unknown>;
    expect(gecko["id"]).toBe(FIREFOX_ADDON_ID);
    expect(gecko["update_url"]).toBe(FIREFOX_UPDATE_URL);
    expect(gecko["strict_min_version"]).toBe("140.0");
    expect(gecko["data_collection_permissions"]).toEqual({ required: ["browsingActivity"] });
  });

  it("Same permission set", () => {
    const firefox = asRecord(buildFirefoxManifest(ORIGIN));
    const chromium = asRecord(buildManifest(ORIGIN));
    expect(effective(firefox)).toEqual(effective(chromium));
    expect(effective(firefox)).toContain("https://fg.example/*");
    expect(effective(firefox)).toContain("<all_urls>");
    expect(firefox["incognito"]).toBe("not_allowed");
    const war = JSON.stringify(firefox["web_accessible_resources"]);
    expect(war).toContain("blocked.html");
  });

  it("Manifest version is pinned", () => {
    expect(FIREFOX_MANIFEST_VERSION).toBe(2);
    const firefox = asRecord(buildFirefoxManifest(ORIGIN));
    const install = [...((firefox["permissions"] as string[] | undefined) ?? []), ...((firefox["host_permissions"] as string[] | undefined) ?? [])];
    expect(install).toContain("<all_urls>");
    expect(JSON.stringify(firefox["optional_permissions"] ?? [])).not.toContain("<all_urls>");
    expect(JSON.stringify(firefox["optional_host_permissions"] ?? [])).not.toContain("<all_urls>");
  });
});

describe("Chromium manifest", () => {
  it("Chromium manifest equals the fixture (builder)", () => {
    const manifest = asRecord(buildManifest(ORIGIN));
    const { name: _n, description: _d, ...parts } = chromiumFixture;
    expect(manifest).toEqual(parts);
    expect(manifest).not.toHaveProperty("browser_specific_settings");
    expect(manifest).not.toHaveProperty("persistent");
  });
});

describe("buildManifest", () => {
  it("Manifest contents", () => {
    const manifest = buildManifest("https://fg.example");
    expect(manifest.permissions).toEqual(["tabs", "idle", "storage", "alarms", "declarativeNetRequest"]);
    expect(manifest.permissions).not.toContain("declarativeNetRequestFeedback");
    expect(manifest.host_permissions).toEqual(["https://fg.example/*", "<all_urls>"]);
    expect(manifest.web_accessible_resources).toEqual([{ resources: ["blocked.html"], matches: ["<all_urls>"] }]);
    expect(manifest.incognito).toBe("not_allowed");
  });

  it("Action key added, permissions unchanged", () => {
    const manifest = buildManifest("https://fg.example");
    expect((manifest as unknown as Record<string, unknown>)["action"]).toEqual({ default_title: "Family Guardian" });
    expect(manifest.permissions).toEqual(["tabs", "idle", "storage", "alarms", "declarativeNetRequest"]);
  });
});
