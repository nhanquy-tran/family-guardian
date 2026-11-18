import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InstallInstructions } from "./install-instructions";

const render = (): string => renderToStaticMarkup(createElement(InstallInstructions));
const webSrc = resolve(__dirname, "..");

function anchorFor(html: string, href: string): string | undefined {
  return html.match(/<a\b[^>]*>/g)?.find((a) => a.includes(`href="${href}"`));
}

describe("InstallInstructions", () => {
  it("Download links", () => {
    const html = render();
    for (const href of ["/install/FamilyGuardian-Setup.reg", "/install/FamilyGuardian-Remove.reg"]) {
      const anchor = anchorFor(html, href);
      expect(anchor, href).toBeDefined();
      expect(anchor).toMatch(/\sdownload(=|\s|>)/);
    }
  });

  it("Standard-account warning comes first", () => {
    const html = render();
    expect(html).toContain("Standard");
    expect(html).toContain("Administrator");
    expect(html.indexOf("Standard")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("Standard")).toBeLessThan(html.indexOf("FamilyGuardian-Setup.reg"));
  });

  it("Verification steps", () => {
    const html = render();
    for (const text of [
      "chrome://policy",
      "edge://policy",
      "brave://policy",
      "ExtensionInstallForcelist",
      "IncognitoModeAvailability",
      "InPrivateModeAvailability",
      "BrowserGuestModeEnabled",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("<ol");
  });

  it("Remove leaves empty keys", () => {
    const html = render();
    expect(html).toContain("empty");
    expect(html).toContain("guest");
  });

  it("Page and home link exist", () => {
    const page = readFileSync(resolve(webSrc, "app/install/page.tsx"), "utf8");
    expect(page).toContain("InstallInstructions");
    const home = readFileSync(resolve(webSrc, "components/site/home.tsx"), "utf8");
    expect(home).toContain('href="/install"');
  });
});
