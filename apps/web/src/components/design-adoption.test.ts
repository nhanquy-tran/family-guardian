import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as uiModule from "./ui";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const uiExports = Object.keys(uiModule);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const isMarkup = (f: string): boolean => f.endsWith(".tsx") && !/\.test\.tsx$/.test(f);
const markupFiles = [...walk(join(srcRoot, "app")), ...walk(join(srcRoot, "components"))].filter(isMarkup);
const rel = (f: string): string => f.slice(srcRoot.length + 1);

describe("screens use the shared styles", () => {
  it("no hard-coded colours", () => {
    expect(markupFiles.length).toBeGreaterThan(10);
    const bad = /neutral-\d|\b(red|green|amber|yellow|blue|rose|slate|gray|zinc|stone)-\d{2,3}\b|#[0-9a-fA-F]{3,8}\b/;
    for (const f of markupFiles) expect(readFileSync(f, "utf8"), rel(f)).not.toMatch(bad);
  });

  it("pages and views use ui.ts", () => {
    const files = [
      "app/login/page.tsx",
      "app/dashboard/page.tsx",
      "app/dashboard/devices/page.tsx",
      "app/dashboard/usage/[childId]/page.tsx",
      "app/dashboard/install/page.tsx",
      "app/dashboard/settings/page.tsx",
      "app/privacy/page.tsx",
      "components/children-list.tsx",
      "components/device-list.tsx",
      "components/block-rules-view.tsx",
      "components/daily-limits-card.tsx",
      "components/homework-settings-view.tsx",
      "components/focus-overview-view.tsx",
      "components/install-instructions.tsx",
      "components/offline-banner.tsx",
    ];
    for (const file of files) {
      const src = readFileSync(join(srcRoot, file), "utf8");
      const imp = src.match(/import\s*\{([^}]*)\}\s*from\s*["'](?:\.{1,2}\/|@\/components\/|(?:\.\.\/)+components\/)?(?:[^"']*\/)?ui["']/);
      expect(imp, `${file} imports ui`).not.toBeNull();
      const names = (imp?.[1] ?? "").split(",").map((n) => n.trim().split(/\s+as\s+/)[0] ?? "");
      const used = names.filter((n) => uiExports.includes(n) && new RegExp(`\\b${n}\\b`).test(src.replace(imp?.[0] ?? "", "")));
      expect(used.length, `${file} uses a ui export`).toBeGreaterThan(0);
    }
  });

  it("offline banner uses the soft warning style", () => {
    const src = readFileSync(join(srcRoot, "components", "offline-banner.tsx"), "utf8");
    expect(src).toMatch(/role="alert"[^>]*className=\{alertWarning\}|className=\{[^}]*alertWarning[^}]*\}[^>]*role="alert"/);
    expect(src).toContain("loadActiveOfflineAlerts(");
    expect(src).toContain("has not reported");
  });

  it("dark mode only through tokens", () => {
    const sources = [join(srcRoot, "components", "ui.ts"), ...markupFiles];
    for (const f of sources) expect(readFileSync(f, "utf8"), rel(f)).not.toMatch(/\bdark:/);
  });
});
