import {
  computeFocusScore,
  dayRangeUtc,
  homeworkDomainsFor,
  localDay,
  type Category,
  type FocusScore,
  type UsageEntry,
} from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FocusToday = FocusScore & { otherSeconds: number };
export type TrendDay = { day: string; score: number | null };
export type ChildFocusResult = { error: true } | { error?: false; today: FocusToday; trend: TrendDay[] };
export type ChildFocus = {
  id: string;
  name: string;
  categories: Category[];
  extraDomains: string[];
  result: ChildFocusResult;
};
export type FocusOverview = { status: "ok"; children: ChildFocus[] } | { status: "error" };

const PAGE = 1000;
const MAX_PAGES = 30;
const DAYS = 7;

type ChildRow = { id: string; name: string; homework_categories: Category[]; homework_domains: string[] };
type UsageRow = { minute_utc: string; domain: string; seconds: number };

function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** All usage rows of the devices in [startUtc, endUtc), or null when any call fails or the page cap is hit. */
async function readUsage(client: SupabaseClient, deviceIds: string[], startUtc: string, endUtc: string): Promise<UsageRow[] | null> {
  const rows: UsageRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await client
      .from("usage_minutes")
      .select("minute_utc, domain, seconds")
      .in("device_id", deviceIds)
      .gte("minute_utc", startUtc)
      .lt("minute_utc", endUtc)
      .order("minute_utc")
      .order("domain")
      .order("device_id")
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error || !data) return null;
    rows.push(...(data as UsageRow[]));
    if (data.length < PAGE) return rows;
  }
  return null;
}

async function loadChild(client: SupabaseClient, child: ChildRow, tz: string, today: string): Promise<ChildFocusResult> {
  const days = Array.from({ length: DAYS }, (_, i) => shiftDay(today, i - (DAYS - 1)));
  const byDay = new Map<string, UsageEntry[]>();

  const { data: devices, error } = await client.from("devices").select("id").eq("child_id", child.id);
  if (error || !devices) return { error: true };

  if (devices.length > 0) {
    const first = days[0] as string;
    const rows = await readUsage(
      client,
      (devices as { id: string }[]).map((d) => d.id),
      dayRangeUtc(first, tz).startUtc,
      dayRangeUtc(today, tz).endUtc,
    );
    if (!rows) return { error: true };
    for (const r of rows) {
      const day = localDay(r.minute_utc, tz);
      const list = byDay.get(day) ?? [];
      list.push({ minuteUtc: r.minute_utc, domain: r.domain, seconds: r.seconds });
      byDay.set(day, list);
    }
  }

  const scoreOf = (day: string): FocusScore => {
    const entries = byDay.get(day) ?? [];
    const homework = homeworkDomainsFor([...new Set(entries.map((e) => e.domain))], {
      categories: child.homework_categories,
      extraDomains: child.homework_domains,
    });
    return computeFocusScore(entries, homework);
  };

  const todayScore = scoreOf(today);
  return {
    today: { ...todayScore, otherSeconds: todayScore.totalSeconds - todayScore.homeworkSeconds },
    trend: days.map((day) => ({ day, score: scoreOf(day).score })),
  };
}

export async function loadFocusOverview(client: SupabaseClient, tz: string, now: Date): Promise<FocusOverview> {
  const { data, error } = await client
    .from("children")
    .select("id, name, homework_categories, homework_domains")
    .order("created_at");
  if (error || !data) return { status: "error" };

  const today = localDay(now.toISOString(), tz);
  const children: ChildFocus[] = [];
  for (const row of data as ChildRow[]) {
    children.push({
      id: row.id,
      name: row.name,
      categories: row.homework_categories,
      extraDomains: row.homework_domains,
      result: await loadChild(client, row, tz, today).catch(() => ({ error: true as const })),
    });
  }
  return { status: "ok", children };
}
