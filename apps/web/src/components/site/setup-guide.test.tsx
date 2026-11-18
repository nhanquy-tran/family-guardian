import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => null }));

import { LOCALES, type Locale } from "../../lib/i18n/locale";
import { getMessages } from "../../lib/i18n/messages";
import { SetupGuide } from "./setup-guide";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

function flatten(value: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = String(value);
  }
  return out;
}

const msgs = (l: Locale) => flatten(getMessages(l));
const render = (l: Locale) => renderToStaticMarkup(createElement(SetupGuide, { locale: l, messages: getMessages(l) }));
const anchors = (html: string) => html.match(/<a\b[^>]*>/g) ?? [];
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

const STEP_KEYS = ["signIn", "child", "code", "installer", "standard", "restart", "pair", "dashboard"];

describe("setup guide page", () => {
  it("Steps in order", () => {
    for (const l of LOCALES) {
      const html = render(l);
      expect(html.match(/<h1\b/g), l).toHaveLength(1);
      expect(html.match(/<ol\b/g), l).toHaveLength(1);
      const items = html.match(/<li\b[\s\S]*?<\/li>/g) ?? [];
      expect(items, l).toHaveLength(8);
      STEP_KEYS.forEach((key, i) => {
        const text = msgs(l)[`setup.steps.${key}`];
        expect(text, `${l} setup.steps.${key}`).toBeTruthy();
        expect(items[i], `${l} step ${key}`).toContain(esc(text));
      });
    }
  });

  it("Links to the install page", () => {
    for (const l of LOCALES) {
      const as = anchors(render(l));
      const hrefs = as.map((a) => attr(a, "href"));
      expect(hrefs, l).toContain("/install");
      expect(hrefs, l).toContain("/login");
      for (const a of as) expect(attr(a, "class") ?? "", a).toContain("focus-visible:");
    }
  });

  it("Same facts as the install page", () => {
    const source = readFileSync(resolve(__dirname, "../install-instructions.tsx"), "utf8");
    const words = ["Chrome", "Edge", "Brave", "Standard", "Administrator"].filter((w) => source.includes(w));
    expect(words.length).toBeGreaterThan(0);
    for (const l of LOCALES) {
      const html = render(l);
      for (const w of words) expect(html, `${l} ${w}`).toContain(w);
    }
  });
});
