import type { SupabaseClient } from "@supabase/supabase-js";
import type { HeartbeatStore } from "./heartbeat";

export function createHeartbeatStore(client: SupabaseClient): HeartbeatStore {
  return {
    async findDevice(tokenHash) {
      const { data, error } = await client
        .from("devices")
        .select("id, children(rules_version)")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const child = data.children as unknown as { rules_version: number } | null;
      if (!child) return null;
      return { deviceId: data.id as string, rulesVersion: child.rules_version };
    },
    async upsertUsage(rows) {
      const { error } = await client.from("usage_minutes").upsert(rows, { onConflict: "device_id,minute_utc,domain" });
      if (error) throw error;
    },
    async insertBlocked() {
      throw new Error("not implemented");
    },
    async updateDevice(deviceId, patch) {
      const { error } = await client.from("devices").update(patch).eq("id", deviceId);
      if (error) throw error;
    },
  };
}
