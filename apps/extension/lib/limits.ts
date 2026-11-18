import type { Category, UsageEntry } from "@fg/shared";
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

export function dayKey(_ms: number, _timezone?: string): string {
  throw new Error("not implemented");
}

export function addUsage(
  _stored: unknown,
  _entries: UsageEntry[],
  _now: number,
  _timezone: string | undefined,
  _overrides: Record<string, Category>,
): LimitUsage {
  throw new Error("not implemented");
}

export function overLimitCategories(_limits: CategoryLimit[], _seconds: Partial<Record<Category, number>>): Category[] {
  throw new Error("not implemented");
}

export function limitBlockDomains(
  _categories: Category[],
  _overrides: Record<string, Category>,
  _seenToday: Record<string, Category>,
  _manualDomains: string[],
): Record<string, Category> {
  throw new Error("not implemented");
}

export function buildLimitRules(_blocked: Record<string, Category>, _firstId: number): Rule[] {
  throw new Error("not implemented");
}
