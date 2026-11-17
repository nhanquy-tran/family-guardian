import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoginForm } from "./login-form";
import * as ui from "./ui";

const u = ui as Record<string, string>;

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
    expect(u.card).toBeTruthy();
    expect(html).toContain(u.card);
    expect(html).toMatch(/<img[^>]*src="\/icon\.svg"/);
    expect(html).toContain("Family Guardian");
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(1);
    const classes = (buttons[0]?.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
    expect(u.buttonPrimary).toBeTruthy();
    for (const c of (u.buttonPrimary ?? "").split(/\s+/)) expect(classes).toContain(c);
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
    expect(u.alertError).toBeTruthy();
    const classes = (el.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
    for (const c of (u.alertError ?? "").split(/\s+/)) expect(classes).toContain(c);
  });
});
