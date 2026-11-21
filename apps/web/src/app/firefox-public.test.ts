import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import { FIREFOX_ADDON_ID } from "@fg/shared";
import nextConfig from "../../next.config";
import { config } from "../proxy";
import sitemap from "./sitemap";

const DIR = join(__dirname, "..", "..", "public", "firefox");
const SOURCE = "/firefox/:name(.+\\.xpi)";

interface Entry {
  version: string;
  update_link: string;
  update_hash: string;
}

function readManifest(): { addons: Record<string, { updates: Entry[] }> } {
  return JSON.parse(readFileSync(join(DIR, "updates.json"), "utf8"));
}

function parts(v: string): number[] {
  return v.split(".").map(Number);
}

function compare(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

describe("firefox public files", () => {
  it("Manifest has the Firefox format", () => {
    const manifest = readManifest();
    expect(Object.keys(manifest.addons)).toEqual([FIREFOX_ADDON_ID]);
    const updates = manifest.addons[FIREFOX_ADDON_ID].updates;
    expect(Array.isArray(updates)).toBe(true);
    for (const entry of updates) {
      expect(entry.version).toMatch(/^\d+(\.\d+)*$/);
      expect(entry.update_link).toBe(`https://family-guardian.co/firefox/family-guardian-${entry.version}.xpi`);
      expect(entry.update_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    for (let i = 1; i < updates.length; i++) {
      expect(compare(updates[i - 1].version, updates[i].version)).toBeLessThan(0);
    }
  });

  it("Manifest and files agree", () => {
    const updates = readManifest().addons[FIREFOX_ADDON_ID].updates;
    for (const entry of updates) {
      expect(existsSync(join(DIR, `family-guardian-${entry.version}.xpi`)), entry.version).toBe(true);
    }
    expect(existsSync(join(DIR, "latest.xpi"))).toBe(updates.length > 0);
    if (updates.length > 0) {
      const newest = updates[updates.length - 1];
      const latest = readFileSync(join(DIR, "latest.xpi"));
      const versioned = readFileSync(join(DIR, `family-guardian-${newest.version}.xpi`));
      expect(latest.equals(versioned)).toBe(true);
    }
  });

  it("Before any release", () => {
    const xpis = readdirSync(DIR).filter((f) => f.endsWith(".xpi"));
    // Applies while nothing is released; once a release is committed the other scenarios cover the directory.
    if (xpis.length === 0) {
      expect(existsSync(join(DIR, "latest.xpi"))).toBe(false);
      expect(readManifest().addons[FIREFOX_ADDON_ID].updates).toEqual([]);
    }
    expect(existsSync(join(DIR, "updates.json"))).toBe(true);
  });
});

describe("firefox public serving", () => {
  it("Content type for add-on files", async () => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((r) => r.source === SOURCE);
    expect(rule).toBeDefined();
    const type = rule!.headers.find((h) => h.key.toLowerCase() === "content-type");
    expect(type?.value).toBe("application/x-xpinstall");
    const re = pathToRegexp(SOURCE);
    expect(re.test("/firefox/latest.xpi")).toBe(true);
    expect(re.test("/firefox/family-guardian-0.3.0.xpi")).toBe(true);
    expect(re.test("/firefox/updates.json")).toBe(false);
  });

  it("No login and not listed", () => {
    const matchers = Array.isArray(config.matcher) ? config.matcher : [config.matcher];
    for (const m of matchers) {
      const source = typeof m === "string" ? m : m.source;
      expect(source.startsWith("/firefox")).toBe(false);
      expect(pathToRegexp(source).test("/firefox/updates.json")).toBe(false);
      expect(pathToRegexp(source).test("/firefox/latest.xpi")).toBe(false);
    }
    for (const item of sitemap()) expect(item.url).not.toContain("/firefox");
  });
});
