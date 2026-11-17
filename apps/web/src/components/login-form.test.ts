import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoginForm } from "./login-form";
import * as uiModule from "./ui";

const ui = uiModule as unknown as Record<string, string>;
const tokens = (s: string): string[] => s.split(/\s+/).filter(Boolean);
const classesOf = (tag: string): string[] => tokens(tag.match(/class="([^"]*)"/)?.[1] ?? "");

describe("LoginForm", () => {
  it("login form renders one Google button", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, {}));
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*>\s*Continue with Google\s*<\/button>/);
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/auth/sign-in"');
    expect(html).not.toContain("<input");
  });

  it("login form shows the error message", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, { error: "auth" }));
    expect(html).toContain("Sign-in failed. Please try again.");
  });

  it("card layout", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, {}));
    expect(ui.card).toBeTruthy();
    expect(html).toContain(ui.card);
    expect(html).toMatch(/<img[^>]*src="\/icon\.svg"/);
    expect(html).toContain("Family Guardian");
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(1);
    const classes = classesOf(buttons[0] ?? "");
    expect(ui.buttonPrimary).toBeTruthy();
    for (const c of tokens(ui.buttonPrimary ?? "")) expect(classes).toContain(c);
    expect(classes).toContain("w-full");
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/auth/sign-in"');
  });

  it("error alert", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, { error: "auth" }));
    const alert = html.match(/<([a-z]+)[^>]*role="alert"[^>]*>[\s\S]*?<\/\1>/);
    expect(alert).not.toBeNull();
    const el = alert?.[0] ?? "";
    expect(el).toContain("Sign-in failed. Please try again.");
    expect(ui.alertError).toBeTruthy();
    const classes = classesOf(el);
    for (const c of tokens(ui.alertError ?? "")) expect(classes).toContain(c);
  });
});
