import { CATEGORIES, type Category } from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DailyLimit = { category: Category; minutesPerDay: number };
export type DailyLimitError = "invalid_category" | "invalid_minutes" | "not_found" | "failed";
export type SaveLimitsResult = { ok: true } | { ok: false; error: DailyLimitError };
export type ListLimitsResult = { ok: true; limits: DailyLimit[] } | { ok: false; error: "failed" };

const TABLE = "child_category_limits";

export async function listDailyLimits(client: SupabaseClient, childId: string): Promise<ListLimitsResult> {
  try {
    const { data, error } = await client.from(TABLE).select("category, minutes_per_day").eq("child_id", childId);
    if (error || !data) return { ok: false, error: "failed" };
    const rows = data as { category: Category; minutes_per_day: number }[];
    const limits = CATEGORIES.flatMap((category) => {
      const row = rows.find((r) => r.category === category);
      return row ? [{ category, minutesPerDay: row.minutes_per_day }] : [];
    });
    return { ok: true, limits };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function saveDailyLimits(
  client: SupabaseClient,
  childId: string,
  values: Record<string, string>,
): Promise<SaveLimitsResult> {
  const known = CATEGORIES as readonly string[];
  const set: { child_id: string; category: string; minutes_per_day: number }[] = [];
  const cleared: string[] = [];
  for (const [category, raw] of Object.entries(values)) {
    if (!known.includes(category)) return { ok: false, error: "invalid_category" };
    const text = raw.trim();
    if (text === "") {
      cleared.push(category);
      continue;
    }
    const minutes = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!(minutes >= 5 && minutes <= 1440)) return { ok: false, error: "invalid_minutes" };
    set.push({ child_id: childId, category, minutes_per_day: minutes });
  }
  try {
    // A delete matching no limit is normal, so a clear-only save checks that RLS lets the parent see the child.
    if (set.length === 0) {
      const { data, error } = await client.from("children").select("id").eq("id", childId);
      if (error || !data) return { ok: false, error: "failed" };
      if (data.length === 0) return { ok: false, error: "not_found" };
    }
    if (set.length > 0) {
      const { error } = await client.from(TABLE).upsert(set, { onConflict: "child_id,category" });
      if (error) return { ok: false, error: "failed" };
    }
    if (cleared.length > 0) {
      const { error } = await client.from(TABLE).delete().eq("child_id", childId).in("category", cleared);
      if (error) return { ok: false, error: "failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "failed" };
  }
}
