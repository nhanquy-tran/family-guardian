import { buttonPrimary, card } from "./ui";

export type WeeklyReportFormProps = {
  enabled: boolean;
  action: (formData: FormData) => void | Promise<void>;
};

export function WeeklyReportForm({ enabled, action }: WeeklyReportFormProps) {
  return (
    <form action={action} className={`${card} max-w-md space-y-4`}>
      <label htmlFor="weekly_report" className="flex items-center gap-2 font-medium">
        <input id="weekly_report" type="checkbox" name="weekly_report" defaultChecked={enabled} />
        Weekly report
      </label>
      <p className="text-sm text-ink-2">
        All parents of the family receive the report on Monday at the digest hour. Turning it on midweek sends the report for the
        previous week on the next Monday.
      </p>
      <button type="submit" className={buttonPrimary}>
        Save
      </button>
    </form>
  );
}
