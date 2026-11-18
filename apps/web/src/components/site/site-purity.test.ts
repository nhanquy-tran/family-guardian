import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => null }));

import LocaleLayout from "../../app/[locale]/layout";
import { LOCALES, type Locale } from "../../lib/i18n/locale";
import { getMessages } from "../../lib/i18n/messages";
import { Faq } from "./faq";
import { Help } from "./help";
import { Home } from "./home";
import { SetupGuide } from "./setup-guide";

const src = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(src, p), "utf8");

function tsxFiles(dir: string): string[] {
  return readdirSync(resolve(src, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? tsxFiles(`${dir}/${e.name}`)
      : e.name.endsWith(".tsx") && !e.name.includes(".test.")
        ? [`${dir}/${e.name}`]
        : [],
  );
}

const sources = () => {
  const files = [...tsxFiles("components/site"), ...tsxFiles("app/[locale]")];
  expect(files.length).toBeGreaterThanOrEqual(4);
  return files.map((f) => [f, read(f)] as const);
};

const renderHome = (l: Locale) => renderToStaticMarkup(createElement(Home, { locale: l, messages: getMessages(l) }));
const renderLayout = async (l: Locale) =>
  renderToStaticMarkup(
    await LocaleLayout({ children: createElement("main", null, "x"), params: Promise.resolve({ locale: l }) }),
  );

describe("public site purity", () => {
  it("Tokens and ui.ts only", () => {
    const banned = [
      /neutral-\d/,
      /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:slate|gray|zinc|stone|orange|yellow|lime|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|amber|green)-\d{2,3}\b/,
      /#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/,
      /dark:/,
      /text-(?:muted|red|amber|green)\b/,
    ];
    for (const [f, text] of sources()) for (const re of banned) expect(text, `${f} ${re}`).not.toMatch(re);
    expect(read("components/site/home.tsx")).toMatch(/from\s+"[^"]*\/ui"/);

    const pkg = JSON.parse(readFileSync(resolve(src, "../package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    for (const name of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]) {
      expect(name.toLowerCase(), name).not.toMatch(/i18n|intl|translate|locale/);
    }

    const layout = read("app/layout.tsx");
    expect(layout).toMatch(/import\s*\{[^}]*\bInter\b[^}]*\}\s*from\s*"next\/font\/google"/);
    expect(layout).toMatch(/subsets:\s*\[[^\]]*"latin"[^\]]*\]/);
    expect(layout).toMatch(/subsets:\s*\[[^\]]*"vietnamese"[^\]]*\]/);
  });

  it("Mobile friendly", async () => {
    for (const l of LOCALES) {
      const home = renderHome(l);
      const layout = await renderLayout(l);
      for (const html of [home, layout]) {
        expect(html).not.toMatch(/w-\[|min-w-\[|whitespace-nowrap/);
      }
      const header = /<header\b[\s\S]*?<\/header>/.exec(layout)?.[0] ?? "";
      const footer = /<footer\b[\s\S]*?<\/footer>/.exec(layout)?.[0] ?? "";
      expect(header, l).toContain("flex-wrap");
      expect(footer, l).toContain("flex-wrap");
    }
  });

  it("Guide pages are mobile friendly", () => {
    for (const l of LOCALES) {
      const m = getMessages(l);
      for (const C of [SetupGuide, Faq, Help]) {
        const html = renderToStaticMarkup(createElement(C, { locale: l, messages: m }));
        expect(html, l).not.toMatch(/w-\[|min-w-\[|whitespace-nowrap/);
        for (const img of html.match(/<img\b[^>]*>/g) ?? []) expect(img).toContain('src="/icon.svg"');
        for (const a of html.match(/<a\b[^>]*>/g) ?? []) expect(a, l).toContain("focus-visible:");
      }
    }
  });

  it("No third-party requests or storage", async () => {
    const forbidden = [/document\.cookie/, /localStorage/, /sessionStorage/, /gtag/, /googletagmanager/, /analytics/i];
    const files = [...sources(), ["app/page.tsx", read("app/page.tsx")] as const];
    for (const [f, text] of files) {
      for (const re of forbidden) expect(text, `${f} ${re}`).not.toMatch(re);
      expect(text, f).not.toMatch(/https?:\/\//);
      expect(text, f).not.toMatch(/import\s*\{[^}]*\bcookies\b[^}]*\}\s*from\s*"next\/headers"/);
      expect(text, f).not.toContain(".cookies.set");
    }
    const msgDir = resolve(src, "messages");
    const jsons = readdirSync(msgDir).filter((f) => f.endsWith(".json"));
    expect(jsons.sort()).toEqual(["en.json", "vi.json", "zh.json"]);
    for (const f of jsons) expect(readFileSync(resolve(msgDir, f), "utf8"), f).not.toMatch(/https?:\/\//);

    for (const l of LOCALES) {
      const html = renderHome(l) + (await renderLayout(l));
      expect(html).not.toMatch(/<script\b[^>]*\bsrc=/);
      expect(html).not.toContain("<iframe");
      expect(html).not.toContain('src="http');
      expect(html).not.toContain('href="http');
    }
  });
});
