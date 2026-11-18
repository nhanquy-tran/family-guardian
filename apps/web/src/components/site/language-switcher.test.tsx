import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: null as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { LanguageSwitcher } from "./language-switcher";

const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const links = (html: string) =>
  (html.match(/<a\b[^>]*>[^<]*/g) ?? []).map((a) => ({
    tag: a,
    href: attr(a, "href"),
    text: a.replace(/<a\b[^>]*>/, ""),
  }));

describe("LanguageSwitcher", () => {
  it("Keeps the current page", () => {
    nav.pathname = "/vi/help";
    const ls = links(renderToStaticMarkup(createElement(LanguageSwitcher, { locale: "vi" })));
    expect(ls.map((l) => [l.text, l.href])).toEqual([
      ["English", "/en/help"],
      ["Tiếng Việt", "/vi/help"],
      ["简体中文", "/zh/help"],
    ]);
    ["en", "vi", "zh"].forEach((code, i) => {
      expect(attr(ls[i].tag, "lang")).toBe(code);
      expect(attr(ls[i].tag, "hreflang")).toBe(code);
      expect(attr(ls[i].tag, "aria-current")).toBe(code === "vi" ? "page" : undefined);
    });

    const src = readFileSync(resolve(__dirname, "language-switcher.tsx"), "utf8");
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
    expect(src).toContain("usePathname");
    const layout = readFileSync(resolve(__dirname, "../../app/[locale]/layout.tsx"), "utf8");
    expect(layout).toContain("LanguageSwitcher");
  });

  it("Home path", () => {
    for (const pathname of ["/en", null]) {
      nav.pathname = pathname;
      const ls = links(renderToStaticMarkup(createElement(LanguageSwitcher, { locale: "en" })));
      expect(ls.map((l) => l.href), String(pathname)).toEqual(["/en", "/vi", "/zh"]);
    }
  });
});
