import { CATEGORIES } from "@fg/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBlockDomain } from "./block-rules";

export type HomeworkError = "invalid_category" | "invalid_domain" | "duplicate" | "too_many" | "not_found" | "failed";
export type HomeworkResult = { ok: true } | { ok: false; error: HomeworkError };

const MAX_DOMAINS = 50;

async function update(client: SupabaseClient, childId: string, values: Record<string, string[]>): Promise<HomeworkResult> {
  try {
    const { data, error } = await client.from("children").update(values).eq("id", childId).select("id");
    if (error || !data) return { ok: false, error: "failed" };
    return data.length > 0 ? { ok: true } : { ok: false, error: "not_found" };
  } catch {
    return { ok: false, error: "failed" };
  }
}

async function readDomains(client: SupabaseClient, childId: string): Promise<string[] | null> {
  try {
    const { data, error } = await client.from("children").select("homework_domains").eq("id", childId).maybeSingle();
    if (error || !data) return null;
    return (data as { homework_domains: string[] }).homework_domains;
  } catch {
    return null;
  }
}

export async function saveHomeworkCategories(client: SupabaseClient, childId: string, categories: string[]): Promise<HomeworkResult> {
  if (!categories.every((c) => (CATEGORIES as readonly string[]).includes(c))) return { ok: false, error: "invalid_category" };
  return update(client, childId, { homework_categories: [...new Set(categories)] });
}

export async function addHomeworkDomain(client: SupabaseClient, childId: string, input: string): Promise<HomeworkResult> {
  const domain = normalizeBlockDomain(input);
  if (!domain) return { ok: false, error: "invalid_domain" };
  const current = await readDomains(client, childId);
  if (!current) return { ok: false, error: "failed" };
  if (current.includes(domain)) return { ok: false, error: "duplicate" };
  if (current.length >= MAX_DOMAINS) return { ok: false, error: "too_many" };
  return update(client, childId, { homework_domains: [...current, domain] });
}

export async function removeHomeworkDomain(client: SupabaseClient, childId: string, domain: string): Promise<HomeworkResult> {
  const current = await readDomains(client, childId);
  if (!current) return { ok: false, error: "failed" };
  return update(client, childId, { homework_domains: current.filter((d) => d !== domain) });
}
