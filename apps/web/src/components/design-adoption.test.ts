import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string): string => readFileSync(join(src, rel), "utf8");

const UI_NAMES = [
  "container", "card", "cardTitle", "pageTitle", "buttonPrimary", "buttonSecondary", "buttonDanger", "input",
  "pillGreen", "pillAmber", "pillRed", "pillAccent", "pillGrey", "table", "th", "td", "navLink", "navLinkCurrent",
  "alertError", "alertWarning",
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : [],
  );
}
const sources = (): string[] => [...walk(join(src, "app")), ...walk(join(src, "components"))];

describe("screens use the shared styles", () => {
  it("no hard-coded colours", () => {
    const files = sources();
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/neutral-\d/);
      expect(text, f).not.toMatch(/\b(red|green|amber|yellow|blue|rose|slate|gray|zinc|stone)-\d{2,3}\b/);
      expect(text, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it("pages and views use ui.ts", () => {
    const files = [
      "app/login/page.tsx",
      "app/dashboard/page.tsx",
      "app/dashboard/children/page.tsx",
      "app/dashboard/devices/page.tsx",
      "app/dashboard/children/[childId]/rules/page.tsx",
      "app/dashboard/children/[childId]/homework/page.tsx",
      "app/dashboard/usage/[childId]/page.tsx",
      "app/dashboard/install/page.tsx",
      "app/dashboard/settings/page.tsx",
      "app/privacy/page.tsx",
      "components/children-list.tsx",
      "components/device-list.tsx",
      "components/block-rules-view.tsx",
      "components/homework-settings-view.tsx",
      "components/focus-overview-view.tsx",
      "components/install-instructions.tsx",
      "components/offline-banner.tsx",
    ];
    for (const f of files) {
      const text = read(f);
      const imp = text.match(/import\s*\{([^}]*)\}\s*from\s*["'](?:\.\/ui|@\/components\/ui|\.\.\/components\/ui)["']/);
      expect(imp, `${f} imports ui`).not.toBeNull();
      const rest = text.replace(imp?.[0] ?? "", "");
      const names = (imp?.[1] ?? "").split(",").map((n) => n.trim()).filter(Boolean);
      expect(
        names.some((n) => UI_NAMES.includes(n) && new RegExp(`\\b${n}\\b`).test(rest)),
        `${f} uses a ui export`,
      ).toBe(true);
    }
  });

  it("offline banner uses the soft warning style", () => {
    const text = read("components/offline-banner.tsx");
    expect(text).toMatch(/role="alert"[^>]*className=\{alertWarning\}|className=\{alertWarning\}[^>]*role="alert"/);
    expect(text).toContain("loadActiveOfflineAlerts");
    expect(text).toContain("has not reported");
  });

  it("dark mode only through tokens", () => {
    for (const f of [...sources(), join(src, "components", "ui.ts")]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/\bdark:/);
    }
  });
});
