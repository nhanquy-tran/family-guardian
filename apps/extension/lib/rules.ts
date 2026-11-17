import type { Get, KeyValueStore } from "./storage";

export interface Rule {
  id: number;
  priority: number;
  action: { type: "redirect"; redirect: { extensionPath: string } };
  condition: { requestDomains: string[]; resourceTypes: ["main_frame"] };
}

export interface Dnr {
  getDynamicRules(): Promise<{ id: number }[]>;
  updateDynamicRules(options: { removeRuleIds: number[]; addRules: Rule[] }): Promise<void>;
}

export interface SyncDeps {
  baseUrl: string;
  token: string;
  store: KeyValueStore;
  get: Get;
  dnr: Dnr;
}

export type SyncResult = { kind: "ok"; rulesVersion: number } | { kind: "failed" };

export function buildRules(_domains: string[]): Rule[] {
  throw new Error("not implemented");
}

export async function applyRules(_dnr: Dnr, _domains: string[]): Promise<void> {
  throw new Error("not implemented");
}

export async function syncRules(_deps: SyncDeps): Promise<SyncResult> {
  throw new Error("not implemented");
}
