// Stub: implementation follows in the developer step (openspec change add-domain-categories).
export type Category =
  | "education"
  | "entertainment"
  | "social"
  | "games"
  | "news"
  | "shopping"
  | "communication"
  | "productivity"
  | "other";

export const CATEGORIES: readonly Category[] = [];

export const SEED_CATEGORIES: Readonly<Record<string, Category>> = {};

export function categorize(_domain: string, _overrides?: Readonly<Record<string, Category>>): Category {
  throw new Error("not implemented");
}
