import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIREFOX_ADDON_ID } from "@fg/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import chromiumFixture from "./fixtures/chromium-manifest.json";
import { FIREFOX_MANIFEST_VERSION } from "./manifest";
import config, { manifestFor } from "../wxt.config";

const ROOT = join(__dirname, "..", "..", "..");
const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as { scripts: Record<string, string> };
const ORIGIN = "https://fg.example";
const rec = (value: unknown) => value as Record<string, unknown>;

type Resolved = Record<string, unknown>;
async function resolve(browser: string): Promise<Resolved> {
  const env = { browser, command: "build", mode: "production", manifestVersion: browser === "firefox" ? 2 : 3 };
  const value: unknown = typeof config === "function" ? await (config as (e: unknown) => unknown)(env) : config;
  return rec(value);
}

describe("WXT config", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Chromium manifest equals the fixture", () => {
    const manifest = rec(manifestFor({ browser: "chrome", apiOrigin: ORIGIN }));
    expect(manifest).toEqual(chromiumFixture);
    expect(manifest).not.toHaveProperty("browser_specific_settings");
    expect(manifest).not.toHaveProperty("persistent");
    expect(manifest["background"] ?? {}).not.toHaveProperty("persistent");
    for (const browser of ["edge", "brave"]) {
      expect(rec(manifestFor({ browser, apiOrigin: ORIGIN }))).toEqual(chromiumFixture);
    }
  });

  it("Firefox target", async () => {
    const manifest = rec(manifestFor({ browser: "firefox", apiOrigin: ORIGIN }));
    const gecko = rec(rec(manifest["browser_specific_settings"])["gecko"]);
    expect(gecko["id"]).toBe(FIREFOX_ADDON_ID);
    expect((await resolve("firefox"))["manifestVersion"]).toBe(FIREFOX_MANIFEST_VERSION);

    let captured: unknown;
    vi.stubGlobal("defineBackground", (options: unknown) => {
      captured = options;
      return options;
    });
    await import("../entrypoints/background");
    expect(rec(captured)["persistent"]).toBe(false);
  });

  it("Scripts", () => {
    const ext = readJson("apps/extension/package.json").scripts;
    const root = readJson("package.json").scripts;
    expect(ext["build:firefox"]).toContain("-b firefox");
    expect(ext["zip:firefox"]).toContain("wxt zip");
    expect(ext["zip:firefox"]).toContain("-b firefox");
    expect(ext["build"]).toBe("wxt build");
    expect(ext["zip"]).toBe("wxt zip");
    const build = root["build"] ?? "";
    const chromium = build.indexOf("npm run build -w extension");
    expect(chromium).toBeGreaterThanOrEqual(0);
    expect(build.indexOf("npm run build:firefox -w extension")).toBeGreaterThan(chromium);
  });

  it("Sources zip config", async () => {
    const zip = rec((await resolve("firefox"))["zip"]);
    expect(zip["sourcesRoot"]).toBe(ROOT.replace(/[\\/]$/, ""));
    const include = JSON.stringify(zip["includeSources"]);
    for (const path of ["apps/extension", "packages/shared", "package.json", "package-lock.json"]) expect(include).toContain(path);
    const exclude = JSON.stringify(zip["excludeSources"]);
    for (const path of [".env", "node_modules", "apps/web"]) expect(exclude).toContain(path);
  });
});
