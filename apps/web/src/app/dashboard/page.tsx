import { resolveTimezone } from "@fg/shared";
import Link from "next/link";
import { Suspense } from "react";
import { FocusOverviewView } from "../../components/focus-overview-view";
import { alertError, card, pageTitle } from "../../components/ui";
import { loadFocusOverview } from "../../lib/focus-overview";
import { createClient } from "../../lib/supabase/server";
import { TimezoneCapture } from "./timezone-capture";
import { TimezoneSync } from "./usage/[childId]/timezone-sync";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const raw = Array.isArray(query.tz) ? query.tz[0] : query.tz;
  const overview = await loadFocusOverview(await createClient(), resolveTimezone(raw ?? null), new Date());
  return (
    <div className="space-y-4">
      <Suspense>
        <TimezoneSync />
      </Suspense>
      <TimezoneCapture />
      <h1 className={pageTitle}>Overview</h1>
      {overview.status === "error" ? (
        <p role="alert" className={alertError}>Could not load</p>
      ) : (
        <>
          <FocusOverviewView items={overview.children} />
          <ul className={`${card} space-y-2`}>
            {overview.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/dashboard/usage/${encodeURIComponent(child.id)}`}
                  className="text-sm font-medium text-accent-ink underline"
                >
                  View usage for {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
