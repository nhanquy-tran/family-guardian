import type { Category, FocusScore } from "@fg/shared";
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

export async function loadFocusOverview(_client: SupabaseClient, _tz: string, _now: Date): Promise<FocusOverview> {
  throw new Error("not implemented");
}
