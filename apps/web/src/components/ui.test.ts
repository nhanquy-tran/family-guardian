import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardShell } from "./dashboard-shell";
import { LoginForm } from "./login-form";
import * as uiModule from "./ui";

const ui: Record<string, unknown> = { ...uiModule };
const NAMES = [
  "container", "card", "cardTitle", "pageTitle", "buttonPrimary", "buttonSecondary", "buttonDanger", "input",
  "pillGreen", "pillAmber", "pillRed", "pillAccent", "pillGrey", "table", "th", "td", "navLink", "navLinkCurrent",
  "alertError", "alertWarning",
];
const cls = (name: string): string => {
  const v = ui[name];
  return typeof v === "string" ? v : "";
};
const constants = (): string[] => Object.values(ui).filter((v): v is string => typeof v === "string");

describe("shared design classes in ui.ts", () => {
  it("constants exist and follow the guide", () => {
    for (const n of NAMES) expect(cls(n), n).not.toBe("");
    for (const t of ["bg-card", "rounded-card", "shadow-card"]) expect(cls("card")).toContain(t);
    for (const b of ["buttonPrimary", "buttonSecondary", "buttonDanger"]) {
      expect(cls(b), b).toContain("rounded-pill");
      expect(cls(b), b).toContain("min-h-10");
    }
    expect(cls("buttonPrimary")).toContain("bg-accent");
    expect(cls("buttonDanger")).toContain("text-ink");
    expect(cls("buttonDanger")).toContain("border-red");
    expect(cls("input")).toMatch(/rounded-/);
    expect(cls("input")).toMatch(/focus(-visible)?:/);
    for (const p of ["pillGreen", "pillAmber", "pillRed", "pillAccent", "pillGrey"]) {
      expect(cls(p), p).toContain("rounded-pill");
    }
    expect(cls("navLinkCurrent")).toContain("bg-accent-soft");
  });

  it("no neutral or palette colours in ui.ts", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "ui.ts"), "utf8");
    expect(constants().length).toBeGreaterThan(0);
    for (const text of [source, ...constants()]) {
      expect(text).not.toMatch(/neutral-/);
      expect(text).not.toMatch(/\b(red|green|amber|yellow|blue|rose|slate|gray|zinc|stone)-\d{2,3}\b/);
      expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});

describe("mobile friendly at 375 px", () => {
  it("no fixed widths", () => {
    expect(constants().length).toBeGreaterThan(0);
    for (const c of constants()) expect(c).not.toBe("");
    const login = renderToStaticMarkup(createElement(LoginForm, { error: "auth" }));
    const shell = renderToStaticMarkup(createElement(DashboardShell, { familyName: "Tran family" }, "body"));
    for (const markup of [login, shell, ...constants()]) {
      expect(markup).not.toMatch(/w-\[|min-w-\[/);
      expect(markup).not.toContain("whitespace-nowrap");
    }
    // unprefixed padding classes of the container: exactly p-4
    expect(cls("container").split(/\s+/).filter((t) => /^p-/.test(t))).toEqual(["p-4"]);
  });

  it("focus is visible", () => {
    for (const n of ["buttonPrimary", "buttonSecondary", "buttonDanger", "input", "navLink"]) {
      expect(cls(n), n).toMatch(/focus(-visible)?:ring-\S*/);
      expect(cls(n), n).toMatch(/focus(-visible)?:ring-\S*accent-soft/);
    }
  });

  it("wide tables scroll inside their card", () => {
    expect(cls("table")).toContain("overflow-x-auto");
  });
});

describe("text colour classes pass contrast", () => {
  it("no low-contrast text classes", () => {
    expect(constants().length).toBeGreaterThan(0);
    for (const [name, v] of Object.entries(ui)) {
      if (typeof v !== "string") continue;
      const text = name === "input" ? v.replace("placeholder:text-muted", "") : v;
      expect(text, name).not.toMatch(/text-(red|amber|green|muted)/);
    }
  });
});
