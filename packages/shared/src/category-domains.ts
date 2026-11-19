import { categorize, SEED_CATEGORIES, type Category } from "./categories";

export type CategoryDomainsInput = {
  categories: readonly Category[];
  overrides?: Readonly<Record<string, Category>>;
  extraHosts?: readonly string[];
  exclude?: Iterable<string>;
  limit: number;
};

const VALID_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const MAX_HOST_LENGTH = 253;

export function categoryDomains(input: CategoryDomainsInput): { domains: string[]; truncated: boolean } {
  const wanted = new Set<Category>(input.categories);
  if (wanted.size === 0) return { domains: [], truncated: false };
  const excluded = new Set(input.exclude ?? []);
  const candidates = new Set([
    ...Object.keys(SEED_CATEGORIES),
    ...Object.keys(input.overrides ?? {}),
    ...(input.extraHosts ?? []),
  ]);
  const all: string[] = [];
  for (const host of candidates) {
    if (host.length > MAX_HOST_LENGTH || !VALID_HOST.test(host) || excluded.has(host)) continue;
    if (wanted.has(categorize(host, input.overrides))) all.push(host);
  }
  all.sort();
  const limit = Math.max(0, input.limit);
  return { domains: all.slice(0, limit), truncated: all.length > limit };
}
