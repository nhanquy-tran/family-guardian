"use client";

import { useEffect } from "react";
import { captureTimezoneAction } from "./settings/actions";

/** Tells the server the browser's timezone once per visit; the server ignores it once the family has saved settings. */
export function TimezoneCapture() {
  useEffect(() => {
    void captureTimezoneAction(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  return null;
}
