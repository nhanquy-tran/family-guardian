import type { Category, DayEntry, TimelineRow } from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageView = "today" | "week";
export type LoadUsageInput = { childId: string; tz: string; view: UsageView; today: string };
export type UsageResult =
  | { status: "ok"; days: DayEntry[]; timeline: TimelineRow[] }
  | { status: "not-found" }
  | { status: "error" };
export type BarSegment = { category: Category; widthPercent: number };

export const USAGE_ERROR_TEXT = "Could not load usage. Try again.";

const notImplemented = (): never => {
  throw new Error("not implemented");
};

export function loadUsage(_client: SupabaseClient, _input: LoadUsageInput): Promise<UsageResult> {
  return notImplemented();
}

export function formatDuration(_seconds: number): string {
  return notImplemented();
}

export function barSegments(_byCategory: Record<Category, number>, _weekMaxSeconds: number): BarSegment[] {
  return notImplemented();
}
