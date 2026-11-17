"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Adds the browser's IANA timezone as ?tz= when it is missing. Nothing is stored or logged. */
export function TimezoneSync() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("tz")) return;
    const next = new URLSearchParams(params.toString());
    next.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);
  return null;
}
