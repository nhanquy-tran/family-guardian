import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => null }));

import { LOCALES, type Locale } from "../../lib/i18n/locale";
import { getMessages } from "../../lib/i18n/messages";
import { Faq } from "./faq";

function flatten(value: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = String(value);
  }
  return out;
}

const render = (l: Locale) => renderToStaticMarkup(createElement(Faq, { locale: l, messages: getMessages(l) }));
const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

type Item = { html: string; summary: string; answer: string };
function items(html: string): Item[] {
  return (html.match(/<details\b[\s\S]*?<\/details>/g) ?? []).map((d) => {
    const summary = /<summary\b[\s\S]*?<\/summary>/.exec(d)?.[0] ?? "";
    return { html: d, summary: plain(summary).toLowerCase(), answer: plain(d.replace(summary, "")) };
  });
}

const questionKeys = (l: Locale) =>
  Object.keys(flatten(JSON.parse(readFileSync(resolve(__dirname, `../../messages/${l}.json`), "utf8")))).filter((k) =>
    /^faq\.q\d+$/.test(k),
  );

describe("faq page", () => {
  it("Disclosure widgets", () => {
    for (const l of LOCALES) {
      const html = render(l);
      expect(html, l).not.toContain("<script");
      const list = items(html);
      expect(list.length, l).toBeGreaterThanOrEqual(10);
      for (const it_ of list) {
        expect(it_.html.match(/<summary\b/g), l).toHaveLength(1);
        expect(attr(/<summary\b[^>]*>/.exec(it_.html)![0], "class") ?? "", l).toContain("focus-visible:");
        expect(it_.answer.length, l).toBeGreaterThan(0);
      }
    }
  });

  it("Required topics", () => {
    const en = items(render("en"));
    const find = (marker: string) => en.findIndex((i) => i.summary.includes(marker));
    const markers = [
      "collect",
      "browser",
      "turn off",
      "block",
      "focus score",
      "offline",
      "children",
      "delete",
      "free",
      "who can see",
    ];
    for (const m of markers) expect(find(m), m).toBeGreaterThanOrEqual(0);

    const collect = en[find("collect")].answer;
    expect(collect).toContain("domain");
    for (const w of ["URL", "keystroke", "screenshot"]) expect(collect, w).toContain(w);

    const browser = en[find("browser")].answer;
    for (const w of ["Chrome", "Edge", "Brave", "Windows"]) expect(browser, w).toContain(w);

    const off = en[find("turn off")].answer;
    expect(off).toContain("Standard");
    expect(off.toLowerCase()).toContain("incognito");
    expect(off.toLowerCase()).toContain("guest");

    const del = en[find("delete")];
    expect(del.answer.toLowerCase()).toMatch(/delet\w* a child|child\w* can be delet|delet\w* (?:the |your )?child/);
    expect(del.answer).toContain("on request");
    expect(del.html).toContain('href="/privacy"');

    const all = en.map((i) => `${i.summary} ${i.answer}`).join(" ").toLowerCase();
    expect(all).not.toContain("delete your account");
    expect(all).not.toContain("at any time");

    for (const l of ["vi", "zh"] as const) {
      const loc = items(render(l));
      expect(loc.length, l).toBe(en.length);
      expect(loc[find("delete")].html, l).toContain('href="/privacy"');
      const locOff = loc[find("turn off")].answer;
      expect(locOff, l).toContain("Standard");
      for (const w of ["Chrome", "Edge", "Brave"]) expect(loc[find("browser")].answer, `${l} ${w}`).toContain(w);
    }
  });

  it("Same questions in every language", () => {
    const en = questionKeys("en");
    expect(en.length).toBeGreaterThanOrEqual(10);
    const raw = (l: Locale) => flatten(JSON.parse(readFileSync(resolve(__dirname, `../../messages/${l}.json`), "utf8")));
    for (const l of ["vi", "zh"] as const) {
      expect(questionKeys(l), l).toHaveLength(en.length);
      expect(raw(l)["faq.q1"], l).not.toBe(raw("en")["faq.q1"]);
      expect(raw(l)["faq.a1"], l).not.toBe(raw("en")["faq.a1"]);
    }
  });
});
