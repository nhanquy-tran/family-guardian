import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => null }));

import { LOCALES, type Locale } from "../../lib/i18n/locale";
import { getMessages } from "../../lib/i18n/messages";
import { Help } from "./help";

const render = (l: Locale, supportEmail?: string) =>
  renderToStaticMarkup(createElement(Help, { locale: l, messages: getMessages(l), supportEmail }));
const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

function elementById(html: string, id: string): string {
  const start = html.search(new RegExp(`<([a-z0-9]+)\\b[^>]*\\bid="${id}"`));
  expect(start, `#${id}`).toBeGreaterThanOrEqual(0);
  const tag = /^<([a-z0-9]+)/.exec(html.slice(start))![1];
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, re.lastIndex);
  }
  throw new Error(`unclosed #${id}`);
}

describe("help page", () => {
  it("Troubleshooting cases", () => {
    const headingMarkers = [/extension/i, /offline/i, /code/i, /block/i, /e-?mail/i];
    for (const l of LOCALES) {
      const html = render(l);
      expect(html.match(/<h1\b/g), l).toHaveLength(1);
      const sections = html.match(/<section\b[\s\S]*?<\/section>/g) ?? [];
      expect(sections, l).toHaveLength(5);
      sections.forEach((s, i) => {
        expect(/<h[23]\b[^>]*>[^<]+<\/h[23]>/.test(s), `${l} heading ${i}`).toBe(true);
        expect(/<p\b[^>]*>[^<]*\S[^<]*<\/p>/.test(s), `${l} text ${i}`).toBe(true);
        expect(s.match(/<li\b/g)?.length ?? 0, `${l} steps ${i}`).toBeGreaterThanOrEqual(1);
        if (l === "en") expect(plain(/<h[23]\b[\s\S]*?<\/h[23]>/.exec(s)![0]), `section ${i}`).toMatch(headingMarkers[i]);
      });
      expect(plain(sections[2]), l).toContain("1");
    }
    const code = plain((render("en").match(/<section\b[\s\S]*?<\/section>/g) ?? [])[2] ?? "");
    expect(code).toContain("1 hour");
    expect(code.toLowerCase()).toMatch(/new code/);
    expect(code.toLowerCase()).toMatch(/replace/);
  });

  it("Contact link shown", () => {
    for (const l of LOCALES) {
      const contact = elementById(render(l, "owner@example.com"), "contact");
      const links = contact.match(/<a\b[^>]*>/g) ?? [];
      const mail = links.filter((a) => attr(a, "href") === "mailto:owner@example.com");
      expect(mail, l).toHaveLength(1);
      expect(attr(mail[0], "class") ?? "", l).toContain("focus-visible:");
    }
  });

  it("Contact hidden without a valid address", () => {
    for (const l of LOCALES) {
      for (const bad of [undefined, "", "not an email", "a@b.c d"]) {
        const html = render(l, bad);
        expect(html, `${l} ${String(bad)}`).not.toContain("mailto:");
        expect(html, `${l} ${String(bad)}`).not.toContain('id="contact"');
      }
    }
  });
});
