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

    async hasRecentEmail(deviceId, since) {
      const { data, error } = await client
        .from("alerts")
        .select("id")
        .eq("device_id", deviceId)
        .eq("kind", "offline")
        .gt("emailed_at", since)
        .limit(1);
      if (error) fail("alerts lookup");
      return (data ?? []).length > 0;
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

    async releaseAlert(deviceId, lastSeenAt) {
      const { error } = await client
        .from("alerts")
        .delete()
        .eq("device_id", deviceId)
        .eq("incident_last_seen_at", lastSeenAt);
      if (error) fail("alert release");
    },

    async listParentEmails(familyId) {
      const { data, error } = await client.from("parents").select("user_id").eq("family_id", familyId);
      if (error) fail("parents lookup");
      const emails: string[] = [];
      for (const row of (data ?? []) as { user_id: string }[]) {
        const res = await client.auth.admin.getUserById(row.user_id);
        if (res.error) fail("auth lookup");
        const email = res.data.user?.email;
        if (email) emails.push(email);
      }
      return emails;
    },
  };
}
