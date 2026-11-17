import { categorize, type Category } from "./categories";

export type HomeworkSettings = { categories: readonly Category[]; extraDomains: readonly string[] };

export function homeworkDomainsFor(usageDomains: readonly string[], settings: HomeworkSettings): string[] {
  const categories = new Set<Category>(settings.categories);
  const isHomework = (d: string) =>
    categories.has(categorize(d)) || settings.extraDomains.some((x) => d === x || d.endsWith(`.${x}`));
  return [...new Set(usageDomains.filter(isHomework))].sort();
}
