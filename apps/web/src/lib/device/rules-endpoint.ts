import type { Category, RulesResponse } from "@fg/shared";

export interface RulesStore {
  findChild(tokenHash: string): Promise<{ childId: string; familyId: string; rulesVersion: number } | null>;
  listRules(childId: string): Promise<{ kind: "domain" | "category"; value: string }[]>;
  /** Global rows (familyId null) and the family's rows; the handler lets family rows win. */
  listCategoryOverrides(familyId: string): Promise<{ familyId: string | null; domain: string; category: Category }[]>;
}

export type RulesInput = { authorization: string | null; store: RulesStore };

export type RulesResult = {
  status: 200 | 401 | 500;
  body: RulesResponse | { error: string };
  headers: Record<string, string>;
};

// Stub: implemented by the developer (add-site-blocking-rules).
export async function handleRules(_input: RulesInput): Promise<RulesResult> {
  throw new Error("not implemented");
}
