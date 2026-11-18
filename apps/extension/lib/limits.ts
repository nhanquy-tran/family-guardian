import { categorize, CATEGORIES, MAX_RULE_DOMAINS, SEED_CATEGORIES, type Category, type UsageEntry } from "@fg/shared";
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

const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

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
  const room = MAX_RULE_DOMAINS - manual.size;
  const wanted = new Set(categories);
  const found: Record<string, Category> = {};
  const candidates = new Set([...Object.keys(SEED_CATEGORIES), ...Object.keys(overrides)]);
  for (const domain of candidates) {
    const category = categorize(domain, overrides);
    if (wanted.has(category)) found[domain] = category;
  }
  for (const domain of Object.keys(seenToday)) {
    const category = categorize(domain, overrides);
    if (wanted.has(category)) found[domain] = category;
  }
  const result: Record<string, Category> = {};
  for (const domain of Object.keys(found).sort()) {
    if (Object.keys(result).length >= room) break;
    const category = found[domain];
    if (category !== undefined && !manual.has(domain) && domain.length <= 253 && DOMAIN_PATTERN.test(domain)) {
      result[domain] = category;
    }
  }
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
  overrides: unknown;
  manualDomains: string[];
  now: number;
  timezone: string | undefined;
}): Record<string, Category> {
  const usage = readUsage(input.usage, dayKey(input.now, input.timezone));
  const over = overLimitCategories(readLimits(input.limits), usage.seconds);
  if (over.length === 0) return {};
  return limitBlockDomains(over, readOverrides(input.overrides), usage.domains, input.manualDomains);
}
