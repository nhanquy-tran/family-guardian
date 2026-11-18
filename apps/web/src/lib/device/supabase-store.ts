import { MAX_RULE_DOMAINS, type Category } from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HeartbeatStore } from "./heartbeat";
import type { RulesStore } from "./rules-endpoint";

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
    async insertBlocked(rows) {
      const { error } = await client
        .from("block_events")
        .upsert(rows, { onConflict: "device_id,at,domain", ignoreDuplicates: true });
      if (error) throw error;
    },
    async updateDevice(deviceId, patch) {
      const { error } = await client.from("devices").update(patch).eq("id", deviceId);
      if (error) throw error;
    },
  };
}

export function createRulesStore(client: SupabaseClient): RulesStore {
  return {
    async findChild(tokenHash) {
      const { data, error } = await client
        .from("devices")
        .select("child_id, children(family_id, rules_version, families(timezone))")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const child = data.children as unknown as {
        family_id: string;
        rules_version: number;
        families: { timezone: string } | null;
      } | null;
      if (!child) return null;
      return {
        childId: data.child_id as string,
        familyId: child.family_id,
        rulesVersion: child.rules_version,
        timezone: child.families?.timezone || "UTC",
      };
    },
    async listRules(childId) {
      const { data, error } = await client
        .from("block_rules")
        .select("kind, value")
        .eq("child_id", childId)
        .limit(MAX_RULE_DOMAINS);
      if (error) throw error;
      return (data ?? []) as { kind: "domain" | "category"; value: string }[];
    },
    async listLimits(childId) {
      const { data, error } = await client
        .from("child_category_limits")
        .select("category, minutes_per_day")
        .eq("child_id", childId);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        category: row.category as Category,
        minutesPerDay: row.minutes_per_day as number,
      }));
    },
    async listCategoryOverrides(familyId) {
      const { data, error } = await client
        .from("domain_categories")
        .select("family_id, domain, category")
        .or(`family_id.is.null,family_id.eq.${familyId}`)
        .limit(MAX_RULE_DOMAINS);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        familyId: row.family_id as string | null,
        domain: row.domain as string,
        category: row.category as Category,
      }));
    },
  };
}
