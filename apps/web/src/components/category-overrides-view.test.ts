import { CATEGORIES } from "@fg/shared";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeBlockDomain } from "../lib/block-rules";
import { CategoryOverridesView, type CategoryOverridesViewProps } from "./category-overrides-view";

const here = dirname(fileURLToPath(import.meta.url));

const OVERRIDES: CategoryOverridesViewProps["overrides"] = [
  { id: "ov-yt", domain: "youtube.com", category: "education" },
  { id: "ov-rb", domain: "roblox.com", category: "games" },
];

function render(props: Partial<CategoryOverridesViewProps> = {}): string {
  return renderToStaticMarkup(
    createElement(CategoryOverridesView, { overrides: OVERRIDES, error: null, ...props }),
  );
}

const forms = (html: string) => html.match(/<form[\s\S]*?<\/form>/g) ?? [];
const domainInput = (html: string) => html.match(/<input[^>]*name="domain"[^>]*>/)?.[0] ?? "";

describe("CategoryOverridesView", () => {
  it("Overrides listed with remove forms", () => {
    const html = render();
    for (const text of ["youtube.com", "education", "roblox.com", "games"]) expect(html).toContain(text);
    for (const [id, domain] of [
      ["ov-yt", "youtube.com"],
      ["ov-rb", "roblox.com"],
    ] as const) {
      const removeForms = forms(html).filter((f) => f.includes(`value="${id}"`));
      expect(removeForms, id).toHaveLength(1);
      const button = removeForms[0]?.match(/<button[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
      expect(button, id).toContain(domain);
    }
  });

  it("Form offers the fixed categories", () => {
    const html = render();
    expect(domainInput(html)).toMatch(/type="text"/);
    const select = /<select[\s\S]*?<\/select>/.exec(html);
    expect(select).not.toBeNull();
    const values = [...select![0].matchAll(/<option[^>]*value="([^"]*)"/g)].map((m) => m[1]);
    expect(values).toEqual([...CATEGORIES]);
  });

  it("Domain pre-filled", () => {
    expect(domainInput(render({ domain: "roblox.com" }))).toContain('value="roblox.com"');
    expect(domainInput(render())).not.toContain("value=");
  });

  it("Invalid domain parameter leaves the input empty", () => {
    const resolved = normalizeBlockDomain("localhost"); // not a valid registrable domain, so null
    expect(resolved).toBeNull();
    expect(domainInput(render({ domain: resolved }))).not.toContain("value=");
  });

  it("Empty state and error messages", () => {
    expect(render({ overrides: [] })).toContain("No overrides");
    const messages = ["invalid_domain", "invalid_category", "not_found", "failed"].map((error) => {
      const html = render({ overrides: [], error });
      return /<p[^>]*role="alert"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    });
    for (const m of messages) expect(m.trim().length).toBeGreaterThan(0);
    expect(new Set(messages).size).toBe(4);
  });

  it("Listing failure is not shown as empty", () => {
    const html = render({ overrides: [], error: "failed" });
    expect(html).toMatch(/could not be loaded or saved/i);
    expect(html).not.toContain("No overrides");
  });

  it("Design tokens and width", () => {
    const source = readFileSync(join(here, "category-overrides-view.tsx"), "utf8");
    expect(source).toMatch(/from "\.\/ui"/);
    for (const banned of ["w-[", "min-w-[", "whitespace-nowrap"]) expect(source).not.toContain(banned);
  });
});
