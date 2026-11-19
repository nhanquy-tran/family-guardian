import { CATEGORIES } from "@fg/shared";
import type { ReactElement } from "react";
import type { DailyLimit } from "../lib/daily-limits";
import { alertError, buttonPrimary, card, cardTitle, input } from "./ui";

export type DailyLimitsCardProps = {
  childId: string;
  limits: DailyLimit[];
  error: string | null;
  action?: (formData: FormData) => void | Promise<void>;
};

function message(error: string): string {
  if (error === "invalid_minutes") return "Enter whole minutes between 5 and 1440, or leave a field empty for no limit.";
  if (error === "not_found") return "This child was not found. Reload the page and try again.";
  return "Limits could not be loaded or saved. Please try again.";
}

export function DailyLimitsCard({ childId, limits, error, action }: DailyLimitsCardProps): ReactElement {
  return (
    <section className={card}>
      <h2 className={cardTitle}>Daily limits</h2>
      <p className="mb-3 text-sm text-ink-2">Minutes per day for each category. Leave empty for no limit.</p>
      {error ? (
        <p role="alert" className={alertError}>
          {message(error)}
        </p>
      ) : null}
      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="childId" value={childId} />
        {CATEGORIES.map((category) => {
          const current = limits.find((l) => l.category === category);
          return (
            <label key={category} className="flex items-center justify-between gap-3 text-sm text-ink">
              <span className="capitalize">{category}</span>
              <input
                className={input}
                type="number"
                min={5}
                max={1440}
                step={1}
                name={`limit_${category}`}
                defaultValue={current?.minutesPerDay}
              />
            </label>
          );
        })}
        <button type="submit" className={buttonPrimary}>
          Save limits
        </button>
      </form>
    </section>
  );
}
