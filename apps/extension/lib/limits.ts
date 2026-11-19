import {
  categorize,
  categoryDomains,
  CATEGORIES,
  MAX_RULE_DOMAINS,
  OtherUsage as OtherUsageSchema,
  type Category,
  type OtherUsage,
  type UsageEntry,
} from "@fg/shared";
import type { Rule } from "./rules";

export interface LimitUsage {
  day: string;
  seconds: Partial<Record<Category, number>>;
  domains: Record<string, Category>;
}

export interface CategoryLimit {
  category: Category;
  minutesPerDay: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function dayKey(ms: number, timezone?: string): string {
  const format = (timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(ms));
  try {
    return format(timezone ?? "UTC");
  } catch {
    return format("UTC");
  }
}

export function readLimits(raw: unknown): CategoryLimit[] {
  if (!Array.isArray(raw)) return [];
  const limits: CategoryLimit[] = [];
  for (const item of raw) {
    if (isObject(item) && isCategory(item["category"]) && typeof item["minutesPerDay"] === "number") {
      limits.push({ category: item["category"], minutesPerDay: item["minutesPerDay"] });
    }
  }
  return limits;
}

export function readOverrides(raw: unknown): Record<string, Category> {
  const result: Record<string, Category> = {};
  if (!isObject(raw)) return result;
  for (const [domain, category] of Object.entries(raw)) if (isCategory(category)) result[domain] = category;
  return result;
}

/** Stored usage for today's day key; anything stored for another day (or malformed) counts as empty. */
export function readUsage(stored: unknown, day: string): LimitUsage {
  if (!isObject(stored) || stored["day"] !== day) return { day, seconds: {}, domains: {} };
  const seconds: Partial<Record<Category, number>> = {};
  if (isObject(stored["seconds"])) {
    for (const [category, value] of Object.entries(stored["seconds"])) {
      if (isCategory(category) && typeof value === "number") seconds[category] = value;
    }
  }
  return { day, seconds, domains: readOverrides(stored["domains"]) };
}

export function parseOtherUsage(raw: unknown): OtherUsage | undefined {
  const parsed = OtherUsageSchema.safeParse(isObject(raw) ? raw["otherUsage"] : undefined);
  return parsed.success ? parsed.data : undefined;
}

/** Local seconds plus the other devices' seconds; a stored value of another day counts as empty. */
export function withOtherUsage(
  local: Partial<Record<Category, number>>,
  stored: unknown,
  day: string,
): Partial<Record<Category, number>> {
  const parsed = OtherUsageSchema.safeParse(stored);
  if (!parsed.success || parsed.data.day !== day) return local;
  const total = { ...local };
  for (const [category, value] of Object.entries(parsed.data.seconds)) {
    if (isCategory(category)) total[category] = (total[category] ?? 0) + value;
  }
  return total;
}

export function addUsage(
  stored: unknown,
  entries: UsageEntry[],
  now: number,
  timezone: string | undefined,
  overrides: Record<string, Category>,
): LimitUsage {
  const day = dayKey(now, timezone);
  const usage = readUsage(stored, day);
  for (const entry of entries) {
    if (dayKey(Date.parse(entry.minuteUtc), timezone) !== day) continue;
    const category = categorize(entry.domain, overrides);
    usage.seconds[category] = (usage.seconds[category] ?? 0) + entry.seconds;
    usage.domains[entry.domain] = category;
  }
  return usage;
}

export function minutesLeft(
  limits: CategoryLimit[],
  seconds: Partial<Record<Category, number>>,
  category: Category | null,
): number | null {
  const limit = limits.find((l) => l.category === category);
  if (limit === undefined || category === null) return null;
  const left = limit.minutesPerDay * 60 - (seconds[category] ?? 0);
  return left > 0 && left <= 300 ? Math.ceil(left / 60) : null;
}

export function overLimitCategories(limits: CategoryLimit[], seconds: Partial<Record<Category, number>>): Category[] {
  return limits.filter((l) => (seconds[l.category] ?? 0) >= l.minutesPerDay * 60).map((l) => l.category);
}

export function limitBlockDomains(
  categories: Category[],
  overrides: Record<string, Category>,
  seenToday: Record<string, Category>,
  manualDomains: string[],
): Record<string, Category> {
  const manual = new Set(manualDomains);
  const { domains } = categoryDomains({
    categories,
    overrides,
    extraHosts: Object.keys(seenToday),
    exclude: manual,
    limit: Math.max(0, MAX_RULE_DOMAINS - manual.size),
  });
  const result: Record<string, Category> = {};
  for (const domain of domains) result[domain] = categorize(domain, overrides);
  return result;
}

export function buildLimitRules(blocked: Record<string, Category>, firstId: number): Rule[] {
  const room = Math.max(0, MAX_RULE_DOMAINS - firstId + 1);
  return Object.keys(blocked)
    .sort()
    .slice(0, room)
    .map((domain, i) => ({
      id: firstId + i,
      priority: 1,
      action: { type: "redirect", redirect: { extensionPath: `/blocked.html?d=${domain}&c=${blocked[domain]}` } },
      condition: { requestDomains: [domain], resourceTypes: ["main_frame"] },
    }));
}

export function evaluateLimitBlocks(input: {
  limits: unknown;
  usage: unknown;
  otherUsage?: unknown;
  overrides: unknown;
  manualDomains: string[];
  now: number;
  timezone: string | undefined;
}): Record<string, Category> {
  const day = dayKey(input.now, input.timezone);
  const usage = readUsage(input.usage, day);
  const over = overLimitCategories(readLimits(input.limits), withOtherUsage(usage.seconds, input.otherUsage, day));
  if (over.length === 0) return {};
  return limitBlockDomains(over, readOverrides(input.overrides), usage.domains, input.manualDomains);
}
