export const ONLINE_THRESHOLD_MS = 180_000;

export function deviceStatus(lastSeenAt: string | null, now: Date): "online" | "offline" {
  if (lastSeenAt === null) return "offline";
  return now.getTime() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS ? "online" : "offline";
}

export function formatLastSeen(lastSeenAt: string | null, now: Date): string {
  if (lastSeenAt === null) return "Never";
  const seconds = (now.getTime() - new Date(lastSeenAt).getTime()) / 1000;
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

const BROWSERS: Record<string, string> = { chrome: "Chrome", edge: "Edge", brave: "Brave" };

export function browserLabel(browser: string): string {
  return Object.hasOwn(BROWSERS, browser) ? (BROWSERS[browser] ?? "Other browser") : "Other browser";
}

export function deviceLabel(device: { name: string | null; browser: string; os: string }): string {
  const name = device.name?.trim();
  return name ? name : `${browserLabel(device.browser)} on ${device.os}`;
}
