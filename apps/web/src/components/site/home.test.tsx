import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => null }));

import LocaleLayout from "../../app/[locale]/layout";
import { LOCALES, type Locale } from "../../lib/i18n/locale";
import { getMessages } from "../../lib/i18n/messages";
import { buttonPrimary, buttonSecondary } from "../ui";
import { Home } from "./home";

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
const renderHome = (l: Locale) => renderToStaticMarkup(createElement(Home, { locale: l, messages: getMessages(l) }));
const renderLayout = async (l: Locale) =>
  renderToStaticMarkup(
    await LocaleLayout({ children: createElement("main", null, "CHILD"), params: Promise.resolve({ locale: l }) }),
  );

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

const anchors = (html: string) => html.match(/<a\b[^>]*>/g) ?? [];
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const valuesUnder = (m: Record<string, string>, prefix: string) =>
  Object.entries(m)
    .filter(([k]) => k === prefix || k.startsWith(`${prefix}.`))
    .map(([, v]) => v);

describe("public home page", () => {
  it("Pages render the locale's messages", () => {
    const en = msgs("en")["hero.title"];
    for (const l of LOCALES) {
      expect(renderHome(l)).toContain(esc(msgs(l)["hero.title"]));
    }
    expect(renderHome("vi")).not.toContain(esc(en));
    expect(renderHome("zh")).not.toContain(esc(en));
  });

  it("Hero", () => {
    const html = renderHome("en");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1\\b[^>]*>[^<]*${esc(msgs("en")["hero.title"])}`));
    const login = anchors(html).find((a) => attr(a, "href") === "/login");
    expect(login).toBeDefined();
    expect(attr(login!, "class")).toContain(buttonPrimary);
    expect(html).toMatch(/<a\b[^>]*href="\/login"[^>]*>[^<]*Sign in as a parent/);
    const how = anchors(html).find((a) => attr(a, "href") === "#how-it-works");
    expect(how).toBeDefined();
    expect(attr(how!, "class")).toContain(buttonSecondary);
  });

  it("How it works and features", () => {
    for (const l of LOCALES) {
      const html = renderHome(l);
      const raw = getMessages(l) as { how: { steps: Record<string, unknown> }; features: Record<string, unknown> };

      const how = elementById(html, "how-it-works");
      expect(how.match(/<ol\b/g), l).toHaveLength(1);
      const items = how.match(/<li\b[\s\S]*?<\/li>/g) ?? [];
      expect(items, l).toHaveLength(4);
      const steps = Object.values(raw.how.steps);
      expect(steps).toHaveLength(4);
      steps.forEach((step, i) => {
        for (const text of Object.values(flatten(step))) expect(items[i], `${l} step ${i}`).toContain(esc(text));
      });
      expect(anchors(items[2]).some((a) => attr(a, "href") === "/install"), l).toBe(true);

      const features = elementById(html, "features");
      const cards = Object.values(raw.features).filter((v) => v !== null && typeof v === "object");
      expect(cards, l).toHaveLength(5);
      for (const card of cards) {
        const title = flatten(card)["title"];
        expect(features, `${l} ${title}`).toContain(esc(title));
      }
    }
  });

  it("Privacy section", () => {
    for (const l of LOCALES) {
      const section = elementById(renderHome(l), "privacy");
      const m = msgs(l);
      const collected = valuesUnder(m, "privacy.collected");
      const never = valuesUnder(m, "privacy.never");
      expect(collected.length, l).toBeGreaterThan(0);
      expect(never.length, l).toBeGreaterThanOrEqual(4);
      for (const text of [...collected, ...never]) expect(section, `${l} ${text}`).toContain(esc(text));
      expect(anchors(section).some((a) => attr(a, "href") === "/privacy"), l).toBe(true);
    }
  });

  it("Language, header and footer", async () => {
    for (const l of ["zh", "vi"] as const) {
      const html = await renderLayout(l);
      expect(html).toMatch(new RegExp(`<[a-z]+\\b[^>]*\\blang="${l}"[^>]*>[\\s\\S]*CHILD`));
      const header = /<header\b[\s\S]*?<\/header>/.exec(html)?.[0] ?? "";
      expect(anchors(header).some((a) => attr(a, "href") === "/login"), l).toBe(true);
      const footer = /<footer\b[\s\S]*?<\/footer>/.exec(html)?.[0] ?? "";
      const hrefs = anchors(footer).map((a) => attr(a, "href"));
      for (const h of ["/privacy", `/${l}/help`, `/${l}/faq`]) expect(hrefs, `${l} ${h}`).toContain(h);
      expect(footer).toContain('hreflang="en"');
      expect(footer).toContain("简体中文");
    }
  });

  it("Footer and home links", async () => {
    const footer = /<footer\b[\s\S]*?<\/footer>/.exec(await renderLayout("vi"))?.[0] ?? "";
    const hrefs = anchors(footer).map((a) => attr(a, "href"));
    for (const h of ["/vi/setup", "/vi/faq", "/vi/help"]) expect(hrefs, h).toContain(h);
    expect(anchors(renderHome("vi")).some((a) => attr(a, "href") === "/vi/setup")).toBe(true);
  });

  it("Focus ring and local illustrations", async () => {
    for (const l of LOCALES) {
      const html = renderHome(l) + (await renderLayout(l));
      const as = anchors(html);
      expect(as.length).toBeGreaterThan(0);
      for (const a of as) expect(attr(a, "class") ?? "", a).toContain("focus-visible:");
      for (const img of html.match(/<img\b[^>]*>/g) ?? []) expect(attr(img, "src")).toBe("/icon.svg");
      expect(html).not.toMatch(/\.(png|jpe?g|webp|gif)\b/i);
    }
  });
});
