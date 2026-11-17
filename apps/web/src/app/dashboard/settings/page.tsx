import { alertError, buttonPrimary, card, input, pageTitle } from "@/components/ui";
import { createClient } from "../../../lib/supabase/server";
import { saveDigestSettingsAction } from "./actions";
import { TimezoneField } from "./timezone-field";

type SearchParams = Promise<{ error?: string | string[]; saved?: string | string[] }>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

type FamilyDigest = { digest_frequency: "daily" | "weekly"; digest_hour: number; timezone: string };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const client = await createClient();
  const { data } = await client.from("families").select("digest_frequency, digest_hour, timezone").maybeSingle();
  const family = data as FamilyDigest | null;
  const frequency = family?.digest_frequency ?? "daily";
  const hour = family?.digest_hour ?? 8;
  const error = first(params.error);

  return (
    <div className="space-y-6">
      <h1 className={pageTitle}>Settings</h1>
      <form action={saveDigestSettingsAction} className={`${card} max-w-md space-y-4`}>
        <fieldset className="space-y-2">
          <legend className="font-medium">E-mail digest</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="frequency" value="daily" defaultChecked={frequency === "daily"} />
            Daily
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="frequency" value="weekly" defaultChecked={frequency === "weekly"} />
            Weekly (Monday)
          </label>
        </fieldset>
        <div className="space-y-1">
          <label htmlFor="hour" className="block font-medium">
            Send at
          </label>
          <select id="hour" name="hour" defaultValue={String(hour)} className={`${input} w-auto`}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
        <TimezoneField fallback={family?.timezone ?? "UTC"} />
        <p className="text-sm text-ink-2">
          All parents of the family receive the digest. Times use the timezone of the browser you save from. Changes apply from the next digest.
        </p>
        <button type="submit" className={buttonPrimary}>
          Save
        </button>
        {first(params.saved) ? <p role="status">Saved</p> : null}
        {error ? (
          <p role="alert" className={alertError}>
            {error === "invalid" ? "Please check the values" : "Could not save"}
          </p>
        ) : null}
      </form>
    </div>
  );
}
