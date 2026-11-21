import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  openedOn: null as string | null,
  setOpenedOn: vi.fn<(v: string | null) => void>(),
  cleanups: [] as (() => void)[],
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: () => [hooks.openedOn, hooks.setOpenedOn],
  useEffect: (fn: () => void | (() => void)) => {
    const cleanup = fn();
    if (cleanup) hooks.cleanups.push(cleanup);
  },
}));
vi.mock("react-dom", () => ({ createPortal: (node: unknown) => ({ portal: node }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams("tz=UTC"),
}));

import { isPlainPost, linkFromTarget, listenForNavigation, NavigationOverlay, SAFETY_MS } from "./navigation-overlay";

const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
const anchor = (href: string, attrs: Record<string, string> = {}) => ({
  href,
  target: attrs.target ?? "",
  hasAttribute: (n: string) => n in attrs,
});
const clickable = (a: unknown) => Object.assign(new EventTarget(), { closest: () => a });
const form = (action: string | null) =>
  Object.assign(new EventTarget(), { tagName: "FORM", getAttribute: () => action });
const event = (type: string, props: Record<string, unknown> = {}) => Object.assign(new Event(type), props);

describe("linkFromTarget and isPlainPost", () => {
  it("reads the link a click landed in", () => {
    expect(linkFromTarget(clickable(anchor("https://app.test/x", { download: "" })))).toEqual({
      href: "https://app.test/x",
      target: "",
      download: true,
    });
    expect(linkFromTarget(clickable(null))).toBeNull();
    expect(linkFromTarget(null)).toBeNull();
    expect(linkFromTarget("text")).toBeNull();
  });

  it("treats only route posts as plain posts", () => {
    expect(isPlainPost(form("/auth/sign-out"))).toBe(true);
    expect(isPlainPost(form("javascript:throw new Error('React form unexpectedly submitted.')"))).toBe(false);
    expect(isPlainPost(form(null))).toBe(false);
    expect(isPlainPost({ tagName: "DIV" })).toBe(false);
    expect(isPlainPost(null)).toBe(false);
  });
});

describe("listenForNavigation", () => {
  const url = new URL("https://app.test/dashboard");
  const setup = (doc: EventTarget) => {
    const win = new EventTarget();
    const onStart = vi.fn();
    const onRestore = vi.fn();
    const stop = listenForNavigation(doc, win, { onStart, onRestore, currentUrl: () => url });
    return { win, onStart, onRestore, stop };
  };

  it("starts on a click to another page, not on other clicks", () => {
    const doc = clickable(anchor("https://app.test/dashboard/devices"));
    const { onStart } = setup(doc);
    doc.dispatchEvent(event("click", { ...plain, metaKey: true }));
    expect(onStart).not.toHaveBeenCalled();
    doc.dispatchEvent(event("click", plain));
    expect(onStart).toHaveBeenCalledWith(url);
    const empty = clickable(null);
    const second = setup(empty);
    empty.dispatchEvent(event("click", plain));
    expect(second.onStart).not.toHaveBeenCalled();
  });

  it("starts on a plain post, not on a server-action form", () => {
    const post = form("/auth/sign-out");
    const a = setup(post);
    post.dispatchEvent(event("submit"));
    expect(a.onStart).toHaveBeenCalledWith(url);
    const action = form("javascript:void 0");
    const b = setup(action);
    action.dispatchEvent(event("submit"));
    expect(b.onStart).not.toHaveBeenCalled();
  });

  it("restores only when the page comes back from the back-forward cache", () => {
    const { win, onRestore } = setup(new EventTarget());
    win.dispatchEvent(event("pageshow", { persisted: false }));
    expect(onRestore).not.toHaveBeenCalled();
    win.dispatchEvent(event("pageshow", { persisted: true }));
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it("removes every listener on cleanup", () => {
    const doc = clickable(anchor("https://app.test/dashboard/devices"));
    const { win, onStart, onRestore, stop } = setup(doc);
    stop();
    doc.dispatchEvent(event("click", plain));
    win.dispatchEvent(event("pageshow", { persisted: true }));
    expect(onStart).not.toHaveBeenCalled();
    expect(onRestore).not.toHaveBeenCalled();
  });
});

describe("NavigationOverlay", () => {
  let doc: EventTarget & { body: object; closest: () => unknown };
  let win: EventTarget & { location: { href: string } };

  beforeEach(() => {
    vi.useFakeTimers();
    hooks.openedOn = null;
    hooks.setOpenedOn.mockReset();
    hooks.cleanups = [];
    doc = Object.assign(new EventTarget(), { body: {}, closest: () => anchor("https://app.test/dashboard/devices") });
    win = Object.assign(new EventTarget(), { location: { href: "https://app.test/dashboard?tz=UTC" } });
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", win);
  });

  afterEach(() => {
    for (const c of hooks.cleanups) c();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renders nothing while idle and opens on the current route when a link is clicked", () => {
    expect(NavigationOverlay()).toBeNull();
    doc.dispatchEvent(event("click", plain));
    expect(hooks.setOpenedOn).toHaveBeenCalledWith("/dashboard?tz=UTC");
    win.dispatchEvent(event("pageshow", { persisted: true }));
    expect(hooks.setOpenedOn).toHaveBeenLastCalledWith(null);
  });

  it("shows the overlay while the route is unchanged and hides after the safety timeout", () => {
    hooks.openedOn = "/dashboard?tz=UTC";
    expect(NavigationOverlay()).toMatchObject({ portal: expect.anything() });
    vi.advanceTimersByTime(SAFETY_MS - 1);
    expect(hooks.setOpenedOn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(hooks.setOpenedOn).toHaveBeenCalledWith(null);
  });

  it("hides once the route changes", () => {
    hooks.openedOn = "/dashboard/children?";
    expect(NavigationOverlay()).toBeNull();
  });
});
