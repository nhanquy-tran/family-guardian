import type { SupabaseClient } from "@supabase/supabase-js";

export type BannerAlert = {
  id: string;
  sent_at: string;
  incident_last_seen_at: string;
  devices: {
    last_seen_at: string | null;
    browser: string;
    os: string;
    children: { name: string } | null;
  } | null;
};

export function activeOfflineAlerts(_rows: BannerAlert[]): BannerAlert[] {
  throw new Error("not implemented");
}

export async function loadActiveOfflineAlerts(_client: SupabaseClient): Promise<BannerAlert[]> {
  throw new Error("not implemented");
}
