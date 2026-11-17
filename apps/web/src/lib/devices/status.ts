export const ONLINE_THRESHOLD_MS = 180_000;

export function deviceStatus(_lastSeenAt: string | null, _now: Date): "online" | "offline" {
  throw new Error("not implemented");
}

export function formatLastSeen(_lastSeenAt: string | null, _now: Date): string {
  throw new Error("not implemented");
}

export function browserLabel(_browser: string): string {
  throw new Error("not implemented");
}

export function deviceLabel(_device: { name: string | null; browser: string; os: string }): string {
  throw new Error("not implemented");
}
