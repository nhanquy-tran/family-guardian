"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoadingOverlay } from "./loading-overlay";

/** Never lock the screen for good if a navigation fails silently. */
const SAFETY_MS = 15_000;

type ClickInfo = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};
type LinkInfo = { href: string; target: string; download: boolean };

export function isPageChange(from: string, to: string): boolean {
  return from !== to;
}

/** True when a click on this link starts an in-app navigation to another page in this tab. */
export function shouldShowForClick(
  click: ClickInfo,
  link: LinkInfo,
  current: URL,
): boolean {
  if (
    click.button !== 0 ||
    click.metaKey ||
    click.ctrlKey ||
    click.shiftKey ||
    click.altKey
  )
    return false;
  if (link.download || (link.target && link.target !== "_self")) return false;
  let next: URL;
  try {
    next = new URL(link.href, current);
  } catch {
    return false;
  }
  if (next.origin !== current.origin) return false;
  return isPageChange(
    current.pathname + current.search,
    next.pathname + next.search,
  );
}

/** Shows the loading overlay from a link click or a plain form post until the new page is on screen. */
export function NavigationOverlay() {
  const pathname = usePathname();
  const route = `${pathname}?${useSearchParams().toString()}`;
  // The route the overlay was opened on: it hides itself as soon as the route changes.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const active = openedOn === route;

  useEffect(() => {
    const setActive = (on: boolean) =>
      setOpenedOn(
        on
          ? `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`
          : null,
      );
    // Capture phase: Next's <Link> calls preventDefault in its own handler.
    const onClick = (e: MouseEvent) => {
      const anchor =
        e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const link = {
        href: anchor.href,
        target: anchor.target,
        download: anchor.hasAttribute("download"),
      };
      if (shouldShowForClick(e, link, new URL(window.location.href)))
        setActive(true);
    };
    // Plain posts (sign out) leave the page; server-action forms use ActionForm instead.
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target;
      if (
        form instanceof HTMLFormElement &&
        (form.getAttribute("action") ?? "").startsWith("/")
      )
        setActive(true);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setActive(false);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setOpenedOn(null), SAFETY_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  return active ? createPortal(<LoadingOverlay />, document.body) : null;
}
