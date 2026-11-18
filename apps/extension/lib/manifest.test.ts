import { describe, expect, it } from "vitest";
import { buildManifest } from "./manifest";

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
