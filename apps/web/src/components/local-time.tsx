"use client";

import { useSyncExternalStore } from "react";
import { formatLocalTime } from "../lib/time/local-time";

/** The browser timezone does not change while the page is open. */
export const subscribeTimeZone = (): (() => void) => () => {};
export const clientTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const serverTimeZone = (): string => "UTC";

/** An absolute time in the parent's browser timezone (UTC, labelled, in the server render). */
export function LocalTime({ iso }: { iso: string }) {
  const timeZone = useSyncExternalStore(subscribeTimeZone, clientTimeZone, serverTimeZone);
  return <time dateTime={iso}>{formatLocalTime(iso, timeZone)}</time>;
}
