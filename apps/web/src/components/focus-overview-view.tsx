import type { ReactElement } from "react";
import type { ChildFocus, TrendDay } from "../lib/focus-overview";

export type FocusOverviewViewProps = { items: ChildFocus[] };

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

function Trend({ trend }: { trend: TrendDay[] }): ReactElement {
  return (
    <ul className="flex items-end gap-1" aria-label="Last 7 days">
      {trend.map((d) => (
        <li key={d.day} className="flex flex-1 flex-col items-center gap-1 text-xs">
          <div className="flex h-16 w-full items-end rounded bg-gray-100">
            {d.score === null ? null : <div className="w-full rounded bg-gray-700" style={{ height: `${d.score}%` }} />}
          </div>
          <span>{d.score === null ? "no data" : d.score}</span>
          <span className="text-gray-500">{d.day.slice(5)}</span>
        </li>
      ))}
    </ul>
  );
}

function Card({ child }: { child: ChildFocus }): ReactElement {
  const { result } = child;
  const configured = child.categories.length > 0 || child.extraDomains.length > 0;
  return (
    <section className="space-y-3 rounded border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">{child.name}</h2>
        <a href={`/dashboard/children/${encodeURIComponent(child.id)}/homework`} className="text-sm underline">
          Homework settings
        </a>
      </div>
      {result.error ? (
        <p role="alert" className="text-red-700">Could not load</p>
      ) : !configured ? (
        <p>
          <a href={`/dashboard/children/${encodeURIComponent(child.id)}/homework`} className="underline">
            Choose what counts as homework
          </a>
        </p>
      ) : (
        <>
          {result.today.score === null ? (
            <p className="text-gray-600">No activity today</p>
          ) : (
            <p>
              <span className="text-4xl font-semibold">{result.today.score}</span>
              <span className="text-sm text-gray-600"> focus score today</span>
            </p>
          )}
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-gray-600">Homework</dt>
              <dd>{formatDuration(result.today.homeworkSeconds)}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Other</dt>
              <dd>{formatDuration(result.today.otherSeconds)}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Switches</dt>
              <dd>{result.today.switches}</dd>
            </div>
          </dl>
          <Trend trend={result.trend} />
        </>
      )}
    </section>
  );
}

export function FocusOverviewView({ items }: FocusOverviewViewProps): ReactElement {
  if (items.length === 0) {
    return (
      <p className="text-sm">
        No children yet. <a href="/dashboard/children" className="underline">Add a child</a>
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((child) => (
          <Card key={child.id} child={child} />
        ))}
      </div>
      <p className="text-sm text-gray-600">
        How is this calculated? The score is the share of active time spent on homework sites, minus up to 20 points
        for frequent switching between homework and other sites. Days without activity have no score.
      </p>
    </div>
  );
}
