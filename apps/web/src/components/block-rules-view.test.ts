import { CATEGORIES } from "@fg/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockRulesView, type BlockRulesViewProps } from "./block-rules-view";

const RULES = [
  { id: "rule-games", kind: "category" as const, value: "games" },
  { id: "rule-yt", kind: "domain" as const, value: "youtube.com" },
];

function render(overrides: Partial<BlockRulesViewProps> = {}): string {
  const props: BlockRulesViewProps = { childId: "c1", childName: "Minh", rules: RULES, error: null, ...overrides };
  return renderToStaticMarkup(createElement(BlockRulesView, props));
}

const forms = (html: string) => html.match(/<form[\s\S]*?<\/form>/g) ?? [];

describe("BlockRulesView", () => {
  it("Rules are listed with remove buttons", () => {
    const html = render();
    for (const text of ["Minh", "games", "youtube.com"]) expect(html).toContain(text);
    for (const id of ["rule-games", "rule-yt"]) {
      expect(forms(html).filter((f) => f.includes(id)), id).toHaveLength(1);
    }
  });

  it("Add forms", () => {
    const html = render();
    expect(html).toMatch(/<input[^>]*type="text"/);
    const select = /<select[\s\S]*?<\/select>/.exec(html);
    expect(select).not.toBeNull();
    const values = [...select![0].matchAll(/<option[^>]*value="([^"]*)"/g)].map((m) => m[1]);
    expect(values).toEqual([...CATEGORIES]);
  });

  it("Listing failure is not shown as empty", () => {
    const html = render({ rules: [], error: "failed" });
    expect(html).toMatch(/could not be loaded or saved/i);
  });

  it("Empty state and error message", () => {
    const invalid = render({ rules: [], error: "invalid_domain" });
    expect(invalid).toContain("No sites blocked");
    expect(invalid).toMatch(/domain/i);
    expect(render({ rules: [], error: "duplicate" })).toContain("already blocked");
  });
});
