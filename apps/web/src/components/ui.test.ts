import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardShell } from "./dashboard-shell";
import { LoginForm } from "./login-form";
import * as ui from "./ui";

describe("mobile friendly at 375 px", () => {
  it("no fixed widths", () => {
    const constants = Object.values(ui).filter((v): v is string => typeof v === "string");
    expect(constants.length).toBeGreaterThan(0);
    for (const c of constants) expect(c).not.toBe("");

    const login = renderToStaticMarkup(createElement(LoginForm, { error: "auth" }));
    const shell = renderToStaticMarkup(createElement(DashboardShell, { familyName: "Tran family" }, "body"));
    for (const markup of [login, shell, ...constants]) {
      expect(markup).not.toMatch(/w-\[|min-w-\[/);
      expect(markup).not.toContain("whitespace-nowrap");
    }

    // unprefixed padding classes of the container: exactly p-4
    const unprefixedPadding = ui.container.split(/\s+/).filter((t) => /^p-/.test(t));
    expect(unprefixedPadding).toEqual(["p-4"]);
  });
});
