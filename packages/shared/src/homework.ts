import type { Category } from "./categories";

export type HomeworkSettings = { categories: readonly Category[]; extraDomains: readonly string[] };

export function homeworkDomainsFor(_usageDomains: readonly string[], _settings: HomeworkSettings): string[] {
  throw new Error("not implemented");
}
