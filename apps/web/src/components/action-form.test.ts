import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: status.pending }),
  createPortal: (node: ReactNode) => node,
}));

import { ActionForm } from "./action-form";

describe("ActionForm while the action runs", () => {
  it("shows the loading overlay only when pending", () => {
    vi.stubGlobal("document", { body: {} });
    const render = () => renderToStaticMarkup(createElement(ActionForm, { action: "/x" }, "fields"));
    status.pending = false;
    expect(render()).not.toContain('role="status"');
    status.pending = true;
    expect(render()).toContain('role="status"');
    vi.unstubAllGlobals();
  });
});
