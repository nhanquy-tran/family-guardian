import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardShell } from "./dashboard-shell";
import { LoginForm } from "./login-form";
import * as uiModule from "./ui";

const ui = uiModule as unknown as Record<string, string>;

const NAMES = [
  "container",
  "card",
  "cardTitle",
  "pageTitle",
  "buttonPrimary",
  "buttonSecondary",
  "buttonDanger",
  "input",
  "pillGreen",
  "pillAmber",
  "pillRed",
  "pillAccent",
  "pillGrey",
  "table",
  "th",
  "td",
  "navLink",
  "navLinkCurrent",
  "alertError",
  "alertWarning",
];

const constants = (): string[] => Object.values(ui).filter((v): v is string => typeof v === "string");
const tokens = (s: string): string[] => s.split(/\s+/).filter(Boolean);

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
    expect(tokens(ui.container ?? "").filter((t) => /^p-/.test(t))).toEqual(["p-4"]);
  });

  it("focus is visible", () => {
    for (const name of ["buttonPrimary", "buttonSecondary", "buttonDanger", "input", "navLink"]) {
      expect(ui[name], name).toMatch(/\bfocus(-visible)?:[^\s]*ring[^\s]*accent-soft/);
    }
  });

  it("wide tables scroll inside their card", () => {
    expect(tokens(ui.table ?? "")).toContain("overflow-x-auto");
  });
});

describe("shared design classes in ui.ts", () => {
  it("constants exist and follow the guide", () => {
    for (const name of NAMES) {
      expect(typeof ui[name], name).toBe("string");
      expect(ui[name], name).not.toBe("");
    }
    for (const c of ["bg-card", "rounded-card", "shadow-card"]) expect(tokens(ui.card ?? "")).toContain(c);
    for (const name of ["buttonPrimary", "buttonSecondary", "buttonDanger"]) {
      expect(tokens(ui[name] ?? ""), name).toContain("rounded-pill");
      expect(tokens(ui[name] ?? ""), name).toContain("min-h-10");
    }
    expect(tokens(ui.buttonPrimary ?? "")).toContain("bg-accent");
    expect(tokens(ui.buttonDanger ?? "")).toContain("text-ink");
    expect(tokens(ui.buttonDanger ?? "")).toContain("border-red");
    expect(ui.input).toMatch(/\brounded-/);
    expect(ui.input).toMatch(/\bfocus(-visible)?:/);
    for (const name of ["pillGreen", "pillAmber", "pillRed", "pillAccent", "pillGrey"]) {
      expect(tokens(ui[name] ?? ""), name).toContain("rounded-pill");
    }
    expect(tokens(ui.navLinkCurrent ?? "")).toContain("bg-accent-soft");
  });

  it("no neutral or palette colours in ui.ts", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "ui.ts"), "utf8");
    const bad = /neutral-\d|\b(red|green|amber|yellow|blue|rose|slate|gray|zinc|stone)-\d{2,3}\b|#[0-9a-fA-F]{3,8}\b/;
    for (const text of [source, ...constants()]) expect(text).not.toMatch(bad);
  });
});

describe("text colour classes pass contrast", () => {
  it("no low-contrast text classes", () => {
    for (const [name, value] of Object.entries(ui)) {
      if (typeof value !== "string") continue;
      const cleaned = name === "input" ? value.replace(/placeholder:text-muted/g, "") : value;
      expect(cleaned, name).not.toMatch(/text-(red|amber|green|muted)\b/);
    }
  });
});
