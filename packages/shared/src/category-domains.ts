import type { Category } from "./categories";

export type CategoryDomainsInput = {
  categories: readonly Category[];
  overrides?: Readonly<Record<string, Category>>;
  extraHosts?: readonly string[];
  exclude?: Iterable<string>;
  limit: number;
};

export function categoryDomains(_input: CategoryDomainsInput): { domains: string[]; truncated: boolean } {
  throw new Error("not implemented");
}
