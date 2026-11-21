"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoadingOverlay } from "./loading-overlay";

/** Never lock the screen for good if a navigation fails silently. */
export const SAFETY_MS = 15_000;

type ClickInfo = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean };
type LinkInfo = { href: string; target: string; download: boolean };
type AnchorLike = { href: string; target: string; hasAttribute: (name: string) => boolean };
type ClosestLike = { closest: (selector: string) => unknown };
type FormLike = { tagName: string; getAttribute: (name: string) => string | null };

export function routeKey(pathname: string, search: string): string {
  return `${pathname}?${search}`;
}

/** True when a click on this link starts an in-app navigation to another page in this tab. */
export function shouldShowForClick(click: ClickInfo, link: LinkInfo, current: URL): boolean {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (link.download || (link.target && link.target !== "_self")) return false;
  let next: URL;
  try {
    next = new URL(link.href, current);
  } catch {
    return false;
  }
  if (next.origin !== current.origin) return false;
  return current.pathname + current.search !== next.pathname + next.search;
}

const hasClosest = (t: unknown): t is ClosestLike =>
  typeof t === "object" && t !== null && typeof (t as ClosestLike).closest === "function";
const isAnchor = (a: unknown): a is AnchorLike =>
  typeof a === "object" && a !== null && typeof (a as AnchorLike).href === "string";
const isForm = (f: unknown): f is FormLike =>
  typeof f === "object" && f !== null && (f as FormLike).tagName === "FORM";

/** The link a click landed in, if any. */
export function linkFromTarget(target: unknown): LinkInfo | null {
  const anchor = hasClosest(target) ? target.closest("a[href]") : null;
  if (!isAnchor(anchor)) return null;
  return { href: anchor.href, target: anchor.target, download: anchor.hasAttribute("download") };
}

/** A plain post to a route (sign out) leaves the page; server-action forms use ActionForm instead. */
export function isPlainPost(target: unknown): boolean {
  return isForm(target) && (target.getAttribute("action") ?? "").startsWith("/");
}

// An options object, not `true`: Node's EventTarget (tests) does not remove a listener added with a boolean.
const CAPTURE = { capture: true };

type Handlers = { onStart: (url: URL) => void; onRestore: () => void; currentUrl: () => URL };

/** Listens for navigations; returns the cleanup. Capture phase: Next's <Link> calls preventDefault. */
export function listenForNavigation(doc: EventTarget, win: EventTarget, { onStart, onRestore, currentUrl }: Handlers) {
  const onClick = (e: Event) => {
    const link = linkFromTarget(e.target);
    const url = currentUrl();
    if (link && shouldShowForClick(e as MouseEvent, link, url)) onStart(url);
  };
  const onSubmit = (e: Event) => {
    if (isPlainPost(e.target)) onStart(currentUrl());
  };
  const onPageShow = (e: Event) => {
    if ((e as PageTransitionEvent).persisted) onRestore();
  };
  doc.addEventListener("click", onClick, CAPTURE);
  doc.addEventListener("submit", onSubmit, CAPTURE);
  win.addEventListener("pageshow", onPageShow);
  return () => {
    doc.removeEventListener("click", onClick, CAPTURE);
    doc.removeEventListener("submit", onSubmit, CAPTURE);
    win.removeEventListener("pageshow", onPageShow);
  };
}

/** Shows the loading overlay from a link click or a plain form post until the new page is on screen. */
export function NavigationOverlay() {
  const route = routeKey(usePathname(), useSearchParams().toString());
  // The route the overlay was opened on: it hides itself as soon as the route changes.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const active = openedOn === route;

  useEffect(
    () =>
      listenForNavigation(document, window, {
        onStart: (url) => setOpenedOn(routeKey(url.pathname, url.searchParams.toString())),
        onRestore: () => setOpenedOn(null),
        currentUrl: () => new URL(window.location.href),
      }),
    [],
  );

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setOpenedOn(null), SAFETY_MS);
    return () => clearTimeout(timer);
  }, [active]);

  return active ? createPortal(<LoadingOverlay />, document.body) : null;
}
