import { computeFocusScore, homeworkDomainsFor, type Category } from "@fg/shared";
import { expect, type Locator, type Page } from "@playwright/test";
import { TIMEZONE, type Fixture } from "../fixtures/scenario.ts";
import { addDays, dateKey, localDate } from "../fixtures/time.ts";

export type TrendDay = { day: string; score: number | null };

/** The seven-day trend the overview should show, computed from the seeded rows the way the dashboard does. */
export function expectedTrend(f: Fixture, childId: string, now = new Date(f.generatedAt)): TrendDay[] {
  const child = f.children.find((c) => c.id === childId);
  if (!child) throw new Error(`no child ${childId}`);
  const devices = new Set(f.devices.filter((d) => d.child_id === childId).map((d) => d.id));
  const today = localDate(now.getTime(), TIMEZONE);
  return Array.from({ length: 7 }, (_, i) => {
    const day = dateKey(addDays(today, i - 6));
    const rows = f.usage.filter(
      (u) => devices.has(u.device_id) && dateKey(localDate(Date.parse(u.minute_utc), TIMEZONE)) === day,
    );
    const homework = homeworkDomainsFor([...new Set(rows.map((r) => r.domain))], {
      categories: child.homework_categories as Category[],
      extraDomains: child.homework_domains,
    });
    const entries = rows.map((r) => ({ minuteUtc: r.minute_utc, domain: r.domain, seconds: r.seconds }));
    return { day, score: computeFocusScore(entries, homework).score };
  });
}

/** Text of one trend bar: the score (or "no data") followed by the MM-DD label. */
export const trendText = (d: TrendDay) => `${d.score ?? "no data"}${d.day.slice(5)}`;

export function focusCard(page: Page, childName: string): Locator {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: childName, exact: true }) });
}

/** Checks today's score line and all seven trend bars of one child's overview card. */
export async function expectFocusCard(page: Page, childName: string, trend: TrendDay[]): Promise<void> {
  const card = focusCard(page, childName);
  const today = trend[trend.length - 1].score;
  if (today === null) await expect(card.getByText("No activity today")).toBeVisible();
  else await expect(card).toContainText(`${today} focus score today`);
  const bars = card.getByRole("list", { name: "Last 7 days" }).getByRole("listitem");
  await expect(bars).toHaveText(trend.map(trendText));
}

export const average = (trend: TrendDay[]) => {
  const scores = trend.map((d) => d.score).filter((s): s is number => s !== null);
  return scores.reduce((s, x) => s + x, 0) / scores.length;
};
