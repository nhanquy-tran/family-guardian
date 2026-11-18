import { MAX_RULE_DOMAINS, RulesResponse, type Category } from "@fg/shared";
import { buildLimitRules, evaluateLimitBlocks } from "./limits";
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
  now?: number;
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

export async function applyRules(
  dnr: Dnr,
  domains: string[],
  limitBlocked: Record<string, Category> = {},
): Promise<void> {
  const existing = await dnr.getDynamicRules();
  const manual = buildRules(domains);
  await dnr.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: [...manual, ...buildLimitRules(limitBlocked, manual.length + 1)],
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
    const { domains, limits, timezone, categoryOverrides } = parsed.data;
    const limitBlocked = evaluateLimitBlocks({
      limits,
      usage: await deps.store.get("limitUsage"),
      overrides: categoryOverrides,
      manualDomains: domains,
      now: deps.now ?? Date.now(),
      timezone,
    });
    await applyRules(deps.dnr, domains, limitBlocked);
    await deps.store.set("rulesLimits", limits);
    if (timezone === undefined) await deps.store.remove(["rulesTimezone"]);
    else await deps.store.set("rulesTimezone", timezone);
    await deps.store.set("rulesOverrides", categoryOverrides);
    await deps.store.set("limitBlocked", limitBlocked);
    await deps.store.set("rulesDomains", parsed.data.domains);
    await deps.store.set("rulesVersion", parsed.data.rulesVersion);
    return { kind: "ok", rulesVersion: parsed.data.rulesVersion };
  } catch {
    return { kind: "failed" };
  }
}
