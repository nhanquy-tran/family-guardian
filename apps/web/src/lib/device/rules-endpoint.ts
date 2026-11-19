import { categoryDomains, MAX_RULE_DOMAINS, OtherUsage as OtherUsageSchema, RulesResponse, type Category, type OtherUsage } from "@fg/shared";
import { hashDeviceToken } from "./token";

export interface RulesStore {
  findChild(tokenHash: string): Promise<{ deviceId: string; childId: string; familyId: string; rulesVersion: number; timezone: string; allowedHours: { start: string; end: string } | null } | null>;
  listLimits(childId: string): Promise<{ category: Category; minutesPerDay: number }[]>;
  listRules(childId: string): Promise<{ kind: "domain" | "category"; value: string }[]>;
  /** Global rows (familyId null) and the family's rows; the handler lets family rows win. */
  listCategoryOverrides(familyId: string): Promise<{ familyId: string | null; domain: string; category: Category }[]>;
  otherUsage(deviceId: string): Promise<OtherUsage | null>;
}

export type RulesInput = { authorization: string | null; store: RulesStore };

export type RulesResult = {
  status: 200 | 401 | 500;
  body: (RulesResponse & { otherUsage?: OtherUsage }) | { error: string };
  headers: Record<string, string>;
};

const HEADERS = { "Cache-Control": "no-store" };
const fail = (status: 401 | 500, error: string): RulesResult => ({ status, body: { error }, headers: HEADERS });

export async function handleRules({ authorization, store }: RulesInput): Promise<RulesResult> {
  const match = /^bearer (\S+)$/i.exec(authorization ?? "");
  if (!match) return fail(401, "unauthorized");

  try {
    const child = await store.findChild(hashDeviceToken(match[1]));
    if (!child) return fail(401, "unauthorized");

    const rules = await store.listRules(child.childId);
    const rows = await store.listCategoryOverrides(child.familyId);
    const limits = await store.listLimits(child.childId);
    const overrides: Record<string, Category> = {};
    for (const row of rows) if (row.familyId === null) overrides[row.domain] = row.category;
    for (const row of rows) if (row.familyId !== null) overrides[row.domain] = row.category;

    const capped: Record<string, Category> = {};
    const mergedKeys = [
      ...rows.filter((r) => r.familyId !== null).map((r) => r.domain),
      ...rows.filter((r) => r.familyId === null).map((r) => r.domain),
    ];
    let count = 0;
    for (const key of new Set(mergedKeys)) {
      if (count >= MAX_RULE_DOMAINS) break;
      const category = overrides[key];
      if (category !== undefined) {
        capped[key] = category;
        count++;
      }
    }

    const explicit = [...new Set(rules.filter((r) => r.kind === "domain").map((r) => r.value))].sort();
    const expanded = categoryDomains({
      categories: rules.filter((r) => r.kind === "category").map((r) => r.value as Category),
      overrides: capped,
      exclude: explicit,
      limit: Math.max(0, MAX_RULE_DOMAINS - explicit.length),
    });
    const body = RulesResponse.parse({
      rulesVersion: child.rulesVersion,
      domains: [...explicit, ...expanded.domains].slice(0, MAX_RULE_DOMAINS),
      truncated: expanded.truncated || explicit.length > MAX_RULE_DOMAINS,
      limits,
      timezone: child.timezone,
      categoryOverrides: capped,
      allowedHours: child.allowedHours,
    });
    let other: OtherUsage | undefined;
    try {
      const parsed = OtherUsageSchema.safeParse(await store.otherUsage(child.deviceId));
      if (parsed.success) other = parsed.data;
    } catch {
      other = undefined;
    }
    return { status: 200, body: other ? { ...body, otherUsage: other } : body, headers: HEADERS };
  } catch {
    return fail(500, "server_error");
  }
}
