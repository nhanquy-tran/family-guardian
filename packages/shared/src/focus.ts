import type { UsageEntry } from "./contracts";

export type FocusScore = {
  score: number | null;
  homeworkSeconds: number;
  totalSeconds: number;
  switches: number;
};

const SESSION_GAP_MINUTES = 5;
const MAX_SWITCH_PENALTY = 20;

export function computeFocusScore(entries: readonly UsageEntry[], homeworkDomains: readonly string[]): FocusScore {
  const homework = new Set(homeworkDomains);
  const minutes = new Map<number, { hw: number; other: number }>();
  let homeworkSeconds = 0;
  let totalSeconds = 0;

  for (const e of entries) {
    const key = Math.floor(Date.parse(e.minuteUtc) / 60000);
    const m = minutes.get(key) ?? { hw: 0, other: 0 };
    if (homework.has(e.domain)) {
      m.hw += e.seconds;
      homeworkSeconds += e.seconds;
    } else {
      m.other += e.seconds;
    }
    totalSeconds += e.seconds;
    minutes.set(key, m);
  }

  if (totalSeconds === 0) return { score: null, homeworkSeconds: 0, totalSeconds: 0, switches: 0 };

  const keys = [...minutes.keys()].sort((a, b) => a - b);
  let switches = 0;
  for (let i = 1; i < keys.length; i++) {
    const prevKey = keys[i - 1];
    const curKey = keys[i];
    if (prevKey === undefined || curKey === undefined) continue;
    if (curKey - prevKey > SESSION_GAP_MINUTES) continue;
    const prev = minutes.get(prevKey);
    const cur = minutes.get(curKey);
    if (!prev || !cur) continue;
    if (prev.hw >= prev.other !== cur.hw >= cur.other) switches++;
  }

  const switchesPerActiveHour = switches / (keys.length / 60);
  const raw = (homeworkSeconds / totalSeconds) * 100 - Math.min(MAX_SWITCH_PENALTY, switchesPerActiveHour * 2);
  const score = Math.min(100, Math.max(0, Math.round(raw)));
  return { score, homeworkSeconds, totalSeconds, switches };
}
