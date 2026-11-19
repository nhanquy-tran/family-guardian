import { categorize, MAX_RULE_DOMAINS, type Category, type OtherUsage } from "@fg/shared";
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
    otherUsage: (deviceId) => otherUsage(client, deviceId),
  };
}

const PAGE = 1000;

async function otherUsage(client: SupabaseClient, deviceId: string): Promise<OtherUsage> {
  const { data: device, error: deviceError } = await client
    .from("devices")
    .select("children(family_id)")
    .eq("id", deviceId)
    .maybeSingle();
  if (deviceError) throw deviceError;
  const familyId = (device?.children as unknown as { family_id: string } | null)?.family_id;
  if (!familyId) throw new Error("device_not_found");

  const { data, error } = await client.rpc("device_other_usage", { p_device_id: deviceId });
  if (error) throw error;
  const rows = (data ?? []) as { day: string; domain: string | null; seconds: number }[];

  const overrides: Record<string, Category> = {};
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: pageError } = await client
      .from("domain_categories")
      .select("domain, category")
      .eq("family_id", familyId)
      .range(from, from + PAGE - 1);
    if (pageError) throw pageError;
    for (const row of page ?? []) overrides[row.domain as string] = row.category as Category;
    if ((page ?? []).length < PAGE) break;
  }

  const seconds: Partial<Record<Category, number>> = {};
  for (const row of rows) {
    if (row.domain === null) continue;
    const category = categorize(row.domain, overrides);
    seconds[category] = (seconds[category] ?? 0) + Number(row.seconds);
  }
  return { day: rows[0]?.day ?? "", seconds };
}

export function createRulesStore(client: SupabaseClient): RulesStore {
  return {
    async findChild(tokenHash) {
      const { data, error } = await client
        .from("devices")
        .select("id, child_id, children(family_id, rules_version, allowed_start, allowed_end, families(timezone))")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const child = data.children as unknown as {
        family_id: string;
        rules_version: number;
        allowed_start: string | null;
        allowed_end: string | null;
        families: { timezone: string } | null;
      } | null;
      if (!child) return null;
      return {
        deviceId: data.id as string,
        childId: data.child_id as string,
        familyId: child.family_id,
        rulesVersion: child.rules_version,
        timezone: child.families?.timezone || "UTC",
        allowedHours:
          child.allowed_start !== null && child.allowed_end !== null
            ? { start: child.allowed_start, end: child.allowed_end }
            : null,
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
    otherUsage: (deviceId) => otherUsage(client, deviceId),
  };
}
