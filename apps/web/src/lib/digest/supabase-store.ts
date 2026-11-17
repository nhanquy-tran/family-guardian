import type { Category } from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { browserLabel } from "../devices/status";
import type { DigestChild, DigestIncident, DigestSource } from "./content";
import type { DigestStore } from "./send";

function fail(what: string): never {
  throw new Error(`${what} failed`);
}

type FamilyRow = { id: string; digest_frequency: "daily" | "weekly"; digest_hour: number; timezone: string; created_at: string };

export function createDigestStore(client: SupabaseClient): DigestStore {
  return {
    async listFamilies() {
      const { data, error } = await client.from("families").select("id, digest_frequency, digest_hour, timezone, created_at");
      if (error || !data) fail("list families");
      return (data as FamilyRow[]).map((f) => ({
        id: f.id,
        frequency: f.digest_frequency,
        hour: f.digest_hour,
        timezone: f.timezone,
        createdAt: f.created_at,
      }));
    },

    async claimDigest(familyId, frequency, periodStart) {
      const { data, error } = await client
        .from("digest_runs")
        .upsert(
          { family_id: familyId, frequency, period_start: periodStart },
          { onConflict: "family_id,frequency,period_start", ignoreDuplicates: true },
        )
        .select("family_id");
      if (error) fail("digest claim");
      return (data ?? []).length > 0;
    },

    async releaseDigest(familyId, frequency, periodStart) {
      const { error } = await client
        .from("digest_runs")
        .delete()
        .eq("family_id", familyId)
        .eq("frequency", frequency)
        .eq("period_start", periodStart);
      if (error) fail("digest release");
    },

    async listParentEmails(familyId) {
      const { data, error } = await client.from("parents").select("user_id").eq("family_id", familyId);
      if (error || !data) fail("list parents");
      const emails: string[] = [];
      for (const row of data as { user_id: string }[]) {
        const { data: found, error: userError } = await client.auth.admin.getUserById(row.user_id);
        if (userError) fail("get parent");
        const email = found.user?.email;
        if (email) emails.push(email);
      }
      return emails;
    },
  };
}

type ChildRow = { id: string; name: string; homework_categories: Category[] | null; homework_domains: string[] | null };
type DeviceRow = { id: string; child_id: string; browser: string; os: string };
type AlertRow = { device_id: string; incident_last_seen_at: string; resolved_at: string | null };
type UsageRow = { minute_utc: string; domain: string; seconds: number };

export function createDigestSource(client: SupabaseClient): DigestSource {
  async function deviceIds(childId: string): Promise<string[]> {
    const { data, error } = await client.from("devices").select("id").eq("child_id", childId);
    if (error || !data) fail("list devices");
    return (data as { id: string }[]).map((d) => d.id);
  }

  return {
    async listChildren(familyId) {
      const { data, error } = await client
        .from("children")
        .select("id, name, homework_categories, homework_domains")
        .eq("family_id", familyId)
        .order("created_at");
      if (error || !data) fail("list children");
      return (data as ChildRow[]).map(
        (c): DigestChild => ({
          id: c.id,
          name: c.name,
          homeworkCategories: c.homework_categories ?? [],
          homeworkDomains: c.homework_domains ?? [],
        }),
      );
    },

    async listIncidents(childIds, start, end) {
      if (childIds.length === 0) return [];
      const { data: devices, error } = await client.from("devices").select("id, child_id, browser, os").in("child_id", childIds);
      if (error || !devices) fail("list devices");
      const byId = new Map((devices as DeviceRow[]).map((d) => [d.id, d]));
      if (byId.size === 0) return [];

      const { data: alerts, error: alertError } = await client
        .from("alerts")
        .select("device_id, incident_last_seen_at, resolved_at")
        .eq("kind", "offline")
        .in("device_id", [...byId.keys()])
        .gte("incident_last_seen_at", start)
        .lt("incident_last_seen_at", end)
        .order("incident_last_seen_at");
      if (alertError || !alerts) fail("list alerts");

      const incidents: DigestIncident[] = [];
      for (const a of alerts as AlertRow[]) {
        const device = byId.get(a.device_id);
        if (!device) continue;
        incidents.push({
          childId: device.child_id,
          browser: browserLabel(device.browser),
          os: device.os,
          startedAt: a.incident_last_seen_at,
          resolvedAt: a.resolved_at,
        });
      }
      return incidents;
    },

    async readUsage(childId, start, end, from, to) {
      const ids = await deviceIds(childId);
      if (ids.length === 0) return [];
      const { data, error } = await client
        .from("usage_minutes")
        .select("minute_utc, domain, seconds")
        .in("device_id", ids)
        .gte("minute_utc", start)
        .lt("minute_utc", end)
        .order("minute_utc")
        .order("domain")
        .order("device_id")
        .range(from, to);
      if (error || !data) fail("read usage");
      return (data as UsageRow[]).map((r) => ({ minuteUtc: r.minute_utc, domain: r.domain, seconds: r.seconds }));
    },
  };
}
