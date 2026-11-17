import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RETENTION_MONTHS } from "../../lib/retention";
import PrivacyPage from "./page";

const html = renderToStaticMarkup(createElement(PrivacyPage));
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** Text of the section that starts at the h2 containing `title`, up to the next h2. */
function section(title: string): string {
  const match = html.match(new RegExp(`<h2[^>]*>[^<]*${title}[^<]*</h2>([\\s\\S]*?)(?=<h2|$)`, "i"));
  return (match?.[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("PrivacyPage", () => {
  it("Collected items listed", () => {
    const collected = section("collects").toLowerCase();
    expect(collected).not.toBe("");
    for (const item of ["domain", "seconds", "blocked", "browser", "operating system", "extension version"]) {
      expect(collected, item).toContain(item);
    }
  });

  it("Never-collected items listed", () => {
    const never = section("never collected").toLowerCase();
    expect(never).not.toBe("");
    for (const item of ["web addresses", "page titles", "page content", "search terms", "keystrokes", "screenshots"]) {
      expect(never, item).toContain(item);
    }
  });

  it("Retention and deletion text", () => {
    expect(text).toContain(`${RETENTION_MONTHS} months`);
    expect(text).toContain("delete a child");
    expect(html).toMatch(/<a [^>]*href="https:\/\/github\.com\/nhanquy-tran\/family-guardian\/issues"/);
    expect(text).not.toContain("whole family account at any time");
    expect(section("Retention").toLowerCase()).toMatch(/request/);
  });
});
