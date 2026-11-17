import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("login form renders one Google button", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, {}));
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*>\s*Continue with Google\s*<\/button>/);
    expect(html).toMatch(/<form[^>]*method="post"/);
    expect(html).toMatch(/<form[^>]*action="\/auth\/sign-in"/);
    expect(html).not.toContain("<input");
  });

  it("login form shows the error message", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, { error: "auth" }));
    expect(html).toContain("Sign-in failed. Please try again.");
  });
});
