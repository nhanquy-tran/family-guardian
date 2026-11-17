import {
  buildTimeline,
  CATEGORIES,
  summarizeDay,
  summarizeWeek,
  type Category,
  type SiteSummary,
} from "@fg/shared";
import type { ReactElement } from "react";
import { alertError, card, cardTitle } from "../../../../components/ui";
import {
  barSegments,
  CATEGORY_COLORS,
  formatDuration,
  USAGE_ERROR_TEXT,
  type UsageResult,
  type UsageView as View,
} from "../../../../lib/usage";

const label = (c: Category) => c.charAt(0).toUpperCase() + c.slice(1);
const emptyCategories = () => Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;

function Legend({ byCategory }: { byCategory: Record<Category, number> }) {
  return (
    <ul className="space-y-1">
      {CATEGORIES.filter((c) => byCategory[c] > 0).map((c) => (
        <li key={c} className="flex items-center gap-2 text-sm">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
          <span>{label(c)}</span>
          <span className="ml-auto">{formatDuration(byCategory[c])}</span>
        </li>
      ))}
    </ul>
  );
}

function Sites({ sites }: { sites: SiteSummary[] }) {
  return (
    <section className={card}>
      <h2 className={cardTitle}>Top sites</h2>
      {sites.length === 0 ? (
        <p className="text-sm text-ink-2">No activity yet.</p>
      ) : (
        <ol className="space-y-1">
          {sites.map((s) => (
            <li key={s.domain} className="flex gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{s.domain}</span>
              <span>{formatDuration(s.seconds)}</span>
              <span className="w-10 text-right">{s.share} %</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const hhmm = (minuteOfDay: number) =>
  `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`;

export function UsageView({
  result,
  view,
  tz,
  today,
}: {
  result: UsageResult;
  view: View;
  tz: string;
  today: string;
}): ReactElement {
  if (result.status !== "ok") return <p role="alert" className={alertError}>{USAGE_ERROR_TEXT}</p>;

  if (view === "week") {
    const week = summarizeWeek(result.days, tz, today);
    const max = Math.max(...week.days.map((d) => d.totalSeconds));
    const total = week.days.reduce((sum, d) => sum + d.totalSeconds, 0);
    const byCategory = emptyCategories();
    for (const d of week.days) for (const c of CATEGORIES) byCategory[c] += d.byCategory[c];
    return (
      <div className="space-y-4">
        <p className="text-sm">Total this week: {formatDuration(total)}</p>
        <ul className={`${card} space-y-2`}>
          {week.days.map((d) => (
            <li key={d.day} className="text-sm">
              <div className="flex justify-between">
                <span>{d.day}</span>
                <span>{formatDuration(d.totalSeconds)}</span>
              </div>
              <div className="flex h-4 w-full overflow-hidden rounded-sm bg-shell">
                {barSegments(d.byCategory, max).map((s) => (
                  <div
                    key={s.category}
                    title={label(s.category)}
                    style={{ width: `${s.widthPercent}%`, backgroundColor: CATEGORY_COLORS[s.category] }}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className={card}>
          <Legend byCategory={byCategory} />
        </div>
        <Sites sites={week.topSites} />
      </div>
    );
  }

  const day = summarizeDay(result.days);
  const slots = buildTimeline(result.timeline, tz, today);
  return (
    <div className="space-y-4">
      <p className="text-lg">Total active time: {formatDuration(day.totalSeconds)}</p>
      <section className={card}>
        <h2 className={cardTitle}>By category</h2>
        <Legend byCategory={day.byCategory} />
      </section>
      <section className={card}>
        <h2 className={cardTitle}>Day timeline</h2>
        <div className="relative h-6 w-full overflow-hidden rounded-sm bg-shell">
          {slots.map((s) => (
            <div
              key={s.minuteOfDay}
              title={`${hhmm(s.minuteOfDay)} ${label(s.category)}`}
              className="absolute top-0 h-full"
              style={{
                left: `${(s.minuteOfDay / 1440) * 100}%`,
                width: `${100 / 1440}%`,
                minWidth: 1,
                backgroundColor: CATEGORY_COLORS[s.category],
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-2">
          <span>00:00</span>
          <span>12:00</span>
          <span>24:00</span>
        </div>
      </section>
      <Sites sites={day.topSites} />
    </div>
  );
}
