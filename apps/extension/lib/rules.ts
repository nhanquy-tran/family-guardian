import { MAX_RULE_DOMAINS, RulesResponse } from "@fg/shared";
import type { Get, KeyValueStore } from "./storage";

export interface Rule {
  id: number;
  priority: number;
  action: { type: "redirect"; redirect: { extensionPath: string } };
  condition: { requestDomains: string[]; resourceTypes: ["main_frame"] };
}

export interface Dnr {
  getDynamicRules(): Promise<{ id: number }[]>;
  updateDynamicRules(options: { removeRuleIds: number[]; addRules: Rule[] }): Promise<void>;
}

export interface SyncDeps {
  baseUrl: string;
  token: string;
  store: KeyValueStore;
  get: Get;
  dnr: Dnr;
}

export type SyncResult = { kind: "ok"; rulesVersion: number } | { kind: "failed" };

const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function buildRules(domains: string[]): Rule[] {
  const valid = new Set<string>();
  for (const domain of domains) {
    if (valid.size >= MAX_RULE_DOMAINS) break;
    if (domain.length <= 253 && DOMAIN_PATTERN.test(domain)) valid.add(domain);
  }
  return [...valid].map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: `/blocked.html?d=${domain}` } },
    condition: { requestDomains: [domain], resourceTypes: ["main_frame"] },
  }));
}

export async function applyRules(dnr: Dnr, domains: string[]): Promise<void> {
  const existing = await dnr.getDynamicRules();
  await dnr.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: buildRules(domains),
  });
}

export async function syncRules(deps: SyncDeps): Promise<SyncResult> {
  try {
    const response = await deps.get(`${deps.baseUrl}/api/device/rules`, {
      headers: { Authorization: `Bearer ${deps.token}` },
    });
    if (response.status !== 200) return { kind: "failed" };
    const parsed = RulesResponse.safeParse(await response.json());
    if (!parsed.success) return { kind: "failed" };
    await applyRules(deps.dnr, parsed.data.domains);
    await deps.store.set("rulesDomains", parsed.data.domains);
    await deps.store.set("rulesVersion", parsed.data.rulesVersion);
    return { kind: "ok", rulesVersion: parsed.data.rulesVersion };
  } catch {
    return { kind: "failed" };
  }
}
