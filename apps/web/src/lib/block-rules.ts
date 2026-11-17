import { CATEGORIES } from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BlockRule = { id: string; kind: "domain" | "category"; value: string };
export type BlockRuleError = "invalid_domain" | "invalid_category" | "duplicate" | "not_found" | "failed";
export type BlockRuleResult = { ok: true } | { ok: false; error: BlockRuleError };
export type ListRulesResult = { ok: true; rules: BlockRule[] } | { ok: false; error: "failed" };

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function normalizeBlockDomain(input: string): string | null {
  let host = input.trim().toLowerCase();
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return null;
    }
  } else {
    host = host.split(/[/?#]/)[0];
  }
  host = host.replace(/:\d*$/, "").replace(/\.$/, "").replace(/^www\./, "");
  if (host.length > 253 || !DOMAIN.test(host) || IPV4.test(host)) return null;
  return host;
}

export async function listBlockRules(client: SupabaseClient, childId: string): Promise<ListRulesResult> {
  const { data, error } = await client.from("block_rules").select("id, kind, value").eq("child_id", childId);
  if (error || !data) return { ok: false, error: "failed" };
  const rules = (data as BlockRule[]).slice().sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "category" ? -1 : 1;
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  });
  return { ok: true, rules };
}

async function insertRule(client: SupabaseClient, childId: string, kind: "domain" | "category", value: string) {
  const { error } = await client.from("block_rules").insert({ child_id: childId, kind, value });
  if (!error) return { ok: true } as const;
  return { ok: false, error: error.code === "23505" ? "duplicate" : "failed" } as const;
}

export async function addDomainRule(client: SupabaseClient, childId: string, input: string): Promise<BlockRuleResult> {
  const value = normalizeBlockDomain(input);
  if (!value) return { ok: false, error: "invalid_domain" };
  return insertRule(client, childId, "domain", value);
}

export async function addCategoryRule(client: SupabaseClient, childId: string, category: string): Promise<BlockRuleResult> {
  if (!(CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: "invalid_category" };
  return insertRule(client, childId, "category", category);
}

export async function removeBlockRule(client: SupabaseClient, ruleId: string): Promise<BlockRuleResult> {
  const { data, error } = await client.from("block_rules").delete().eq("id", ruleId).select("id");
  if (error || !data) return { ok: false, error: "failed" };
  return data.length > 0 ? { ok: true } : { ok: false, error: "not_found" };
}
