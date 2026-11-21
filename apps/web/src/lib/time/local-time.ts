import { resolveTimezone } from "@fg/shared";

/** `21 Nov, 17:40 GMT+7`: 24-hour time with the zone name, so a UTC fallback is never mistaken for local time. */
export function formatLocalTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
    timeZone: resolveTimezone(timeZone),
  }).format(new Date(iso));
}
