import { CATEGORIES, type Category, type DayEntry, type TimelineRow } from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageView = "today" | "week";
export type LoadUsageInput = { childId: string; tz: string; view: UsageView; today: string };
export type UsageResult =
  | { status: "ok"; days: DayEntry[]; timeline: TimelineRow[]; overrides: Record<string, Category> }
  | { status: "not-found" }
  | { status: "error" };
export type BarSegment = { category: Category; widthPercent: number };

export const USAGE_ERROR_TEXT = "Could not load usage. Try again.";

export const CATEGORY_COLORS: Record<Category, string> = {
  education: "#2f7d4f",
  entertainment: "#c2410c",
  social: "#be185d",
  games: "#7c3aed",
  news: "#0369a1",
  shopping: "#a16207",
  communication: "#0f766e",
  productivity: "#4338ca",
  other: "#6b7280",
};

const PAGE_SIZE = 1000;

type Row = Record<string, unknown>;

/** Reads every page of an RPC with explicit ranges; null if any page fails, so no partial data escapes. */
async function readAll(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  orderBy: string[],
): Promise<Row[] | null> {
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.rpc(name, args);
    for (const column of orderBy) query = query.order(column);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error || !Array.isArray(data)) return null;
    all.push(...(data as Row[]));
    if (data.length < PAGE_SIZE) return all;
  }
}

export async function loadUsage(client: SupabaseClient, input: LoadUsageInput): Promise<UsageResult> {
  const { data: child, error } = await client.from("children").select("id").eq("id", input.childId).maybeSingle();
  if (error) return { status: "error" };
  if (!child) return { status: "not-found" };

  const days = await readAll(
    client,
    "usage_by_day",
    { child_id: input.childId, tz: input.tz, days: input.view === "week" ? 7 : 1 },
    ["day", "domain"],
  );
  if (!days) return { status: "error" };
  const entries: DayEntry[] = days.map((r) => ({
    day: String(r.day),
    domain: String(r.domain),
    seconds: Number(r.seconds),
  }));

  let timeline: TimelineRow[] = [];
  if (input.view === "today") {
    const rows = await readAll(
      client,
      "usage_timeline",
      { child_id: input.childId, tz: input.tz, day: input.today },
      ["minute_of_day"],
    );
    if (!rows) return { status: "error" };
    timeline = rows.map((r) => ({
      minuteOfDay: Number(r.minute_of_day),
      domains: Array.isArray(r.domains) ? (r.domains as string[]) : [],
      seconds: Array.isArray(r.seconds) ? (r.seconds as number[]) : [],
    }));
  }
  const { data: cats, error: catsError } = await client.from("domain_categories").select("domain, category, family_id");
  if (catsError || !Array.isArray(cats)) return { status: "error" };
  const rows = cats as { domain: string; category: Category; family_id: string | null }[];
  const overrides: Record<string, Category> = {};
  for (const r of rows) if (r.family_id === null) overrides[r.domain.toLowerCase()] = r.category;
  for (const r of rows) if (r.family_id !== null) overrides[r.domain.toLowerCase()] = r.category;
  return { status: "ok", days: entries, timeline, overrides };
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export function barSegments(byCategory: Record<Category, number>, weekMaxSeconds: number): BarSegment[] {
  if (weekMaxSeconds <= 0) return [];
  return CATEGORIES.filter((c) => byCategory[c] > 0).map((category) => ({
    category,
    widthPercent: (byCategory[category] / weekMaxSeconds) * 100,
  }));
}
