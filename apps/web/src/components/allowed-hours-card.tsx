import { ActionForm } from "./action-form";
import type { ReactElement } from "react";
import { alertError, buttonPrimary, card, cardTitle, input } from "./ui";

export type AllowedHoursCardProps = {
  childId: string;
  hours: { start: string; end: string } | null;
  error: string | null;
  action?: (formData: FormData) => void | Promise<void>;
};

function message(error: string): string {
  if (error === "invalid_hours") return "Enter a start and an end time that are different, or leave both empty.";
  if (error === "not_found") return "This child was not found. Reload the page and try again.";
  return "Allowed hours could not be saved. Please try again.";
}

export function AllowedHoursCard({ childId, hours, error, action }: AllowedHoursCardProps): ReactElement {
  return (
    <section className={card}>
      <h2 className={cardTitle}>Allowed hours</h2>
      <p className="mb-3 text-sm text-ink-2">
        Browsing is paused outside this window, in your family timezone. Start and end must be set together; leave both
        empty to remove the limit.
      </p>
      {error ? (
        <p role="alert" className={alertError}>
          {message(error)}
        </p>
      ) : null}
      <ActionForm action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="childId" value={childId} />
        <label className="flex items-center justify-between gap-3 text-sm text-ink">
          <span>Start</span>
          <input className={input} type="time" name="allowed_start" defaultValue={hours?.start} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm text-ink">
          <span>End</span>
          <input className={input} type="time" name="allowed_end" defaultValue={hours?.end} />
        </label>
        <button type="submit" className={buttonPrimary}>
          Save allowed hours
        </button>
      </ActionForm>
    </section>
  );
}
