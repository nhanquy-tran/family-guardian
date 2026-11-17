import type { SupabaseClient } from "@supabase/supabase-js";
import type { OfflineAlertStore, OfflineDevice } from "./offline";

type OfflineRow = {
  device_id: string;
  family_id: string;
  child_name: string;
  browser: string;
  os: string;
  last_seen_at: string;
};

function fail(what: string): never {
  throw new Error(`${what} failed`);
}

export function createOfflineAlertStore(client: SupabaseClient): OfflineAlertStore {
  return {
    async findOfflineDevices(now) {
      const { data, error } = await client.rpc("find_offline_devices", { p_now: now });
      if (error) fail("find_offline_devices");
      return ((data ?? []) as OfflineRow[]).map(
        (r): OfflineDevice => ({
          deviceId: r.device_id,
          familyId: r.family_id,
          childName: r.child_name,
          browser: r.browser,
          os: r.os,
          lastSeenAt: r.last_seen_at,
        }),
      );
    },

    async claimAlert(deviceId, lastSeenAt, emailedAt) {
      const { data, error } = await client
        .from("alerts")
        .upsert(
          { device_id: deviceId, kind: "offline", incident_last_seen_at: lastSeenAt, emailed_at: emailedAt },
          { onConflict: "device_id,incident_last_seen_at", ignoreDuplicates: true },
        )
        .select("id");
      if (error) fail("alert claim");
      return (data ?? []).length > 0;
    },

    async resolveReturned(now) {
      const { error } = await client.rpc("resolve_offline_alerts", { p_now: now });
      if (error) fail("resolve_offline_alerts");
    },
  };
}
