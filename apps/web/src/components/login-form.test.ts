import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoginForm } from "./login-form";
import { card } from "./ui";

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
    expect(card).not.toBe("");
    expect(html).toContain(card);
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toMatch(/class="[^"]*\bw-full\b/);
    expect(buttons[0]).toMatch(/class="[^"]*\bmin-h-10\b/);
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/auth/sign-in"');
  });

  it("error alert", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, { error: "auth" }));
    const alert = html.match(/<([a-z]+)[^>]*role="alert"[^>]*>[\s\S]*?<\/\1>/);
    expect(alert).not.toBeNull();
    const el = alert?.[0] ?? "";
    expect(el).toContain("Sign-in failed. Please try again.");
    expect(el).toMatch(/class="[^"]*\btext-red-\d+/);
    expect(el).toMatch(/class="[^"]*\bbg-red-\d+/);
  });
});
