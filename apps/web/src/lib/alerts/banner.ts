import type { SupabaseClient } from "@supabase/supabase-js";

export type BannerAlert = {
  id: string;
  sent_at: string;
  incident_last_seen_at: string;
  resolved_at: string | null;
  devices: {
    last_seen_at: string | null;
    browser: string;
    os: string;
    children: { name: string } | null;
  } | null;
};

export function activeOfflineAlerts(rows: BannerAlert[]): BannerAlert[] {
  return rows
    .filter(
      (a) =>
        a.devices?.last_seen_at != null &&
        Date.parse(a.devices.last_seen_at) === Date.parse(a.incident_last_seen_at),
    )
    .sort((a, b) => Date.parse(b.sent_at) - Date.parse(a.sent_at));
}

export async function loadActiveOfflineAlerts(client: SupabaseClient): Promise<BannerAlert[]> {
  try {
    const { data, error } = await client
      .from("alerts")
      .select("id, sent_at, incident_last_seen_at, devices(last_seen_at, browser, os, children(name))")
      .eq("kind", "offline");
    if (error || !data) return [];
    return activeOfflineAlerts(data as unknown as BannerAlert[]);
  } catch {
    return [];
  }
}
