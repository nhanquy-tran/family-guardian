import { localDay, resolveTimezone } from "@fg/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { pageTitle } from "../../../../components/ui";
import { createClient } from "../../../../lib/supabase/server";
import { loadUsage, type UsageView as View } from "../../../../lib/usage";
import { TimezoneSync } from "./timezone-sync";
import { UsageView } from "./usage-view";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: SearchParams;
}) {
  const { childId } = await params;
  const query = await searchParams;
  const tz = resolveTimezone(first(query.tz));
  const view: View = first(query.view) === "week" ? "week" : "today";
  const today = localDay(new Date().toISOString(), tz);

  const client = await createClient();
  const result = await loadUsage(client, { childId, tz, view, today });
  if (result.status === "not-found") notFound();

  const tab = (v: View, text: string) => (
    <Link
      href={`?view=${v}&tz=${encodeURIComponent(tz)}`}
      aria-current={view === v ? "page" : undefined}
      className={`rounded px-3 py-1 text-sm ${view === v ? "bg-gray-900 text-white" : "bg-gray-100"}`}
    >
      {text}
    </Link>
  );

  return (
    <div className="max-w-full space-y-4">
      <Suspense>
        <TimezoneSync />
      </Suspense>
      <h1 className={pageTitle}>Usage</h1>
      <nav className="flex gap-2">
        {tab("today", "Today")}
        {tab("week", "Week")}
      </nav>
      <UsageView result={result} view={view} tz={tz} today={today} />
    </div>
  );
}
