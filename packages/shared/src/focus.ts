import type { UsageEntry } from "./contracts";

export type FocusScore = {
  score: number | null;
  homeworkSeconds: number;
  totalSeconds: number;
  switches: number;
};

export function computeFocusScore(entries: readonly UsageEntry[], homeworkDomains: readonly string[]): FocusScore {
  void entries;
  void homeworkDomains;
  throw new Error("not implemented");
}
