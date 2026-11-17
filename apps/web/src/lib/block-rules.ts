import type { SupabaseClient } from "@supabase/supabase-js";

export type BlockRule = { id: string; kind: "domain" | "category"; value: string };
export type BlockRuleError = "invalid_domain" | "invalid_category" | "duplicate" | "not_found" | "failed";
export type BlockRuleResult = { ok: true } | { ok: false; error: BlockRuleError };
export type ListRulesResult = { ok: true; rules: BlockRule[] } | { ok: false; error: "failed" };

// Stubs: implemented by the developer (add-site-blocking-rules).
export function normalizeBlockDomain(_input: string): string | null {
  throw new Error("not implemented");
}

export async function listBlockRules(_client: SupabaseClient, _childId: string): Promise<ListRulesResult> {
  throw new Error("not implemented");
}

export async function addDomainRule(_client: SupabaseClient, _childId: string, _input: string): Promise<BlockRuleResult> {
  throw new Error("not implemented");
}

export async function addCategoryRule(_client: SupabaseClient, _childId: string, _category: string): Promise<BlockRuleResult> {
  throw new Error("not implemented");
}

export async function removeBlockRule(_client: SupabaseClient, _ruleId: string): Promise<BlockRuleResult> {
  throw new Error("not implemented");
}
