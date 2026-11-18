import type { Rule } from "./rules";

export interface AllowedHours {
  start: string;
  end: string;
}

export const ALLOWED_HOURS_RULE_ID = 2000000;

export function inAllowedHours(_hours: unknown, _nowMs: number, _timezone?: string): boolean {
  throw new Error("not implemented");
}

export function nextEdge(_hours: unknown, _nowMs: number, _timezone?: string): number | null {
  throw new Error("not implemented");
}

export function buildHoursRule(_start: string): Rule {
  throw new Error("not implemented");
}
