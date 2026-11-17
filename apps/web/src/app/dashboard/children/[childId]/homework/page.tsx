import type { Category } from "@fg/shared";
import { notFound } from "next/navigation";
import { HomeworkSettingsView } from "../../../../../components/homework-settings-view";
import type { HomeworkError } from "../../../../../lib/homework";
import { createClient } from "../../../../../lib/supabase/server";
import { addDomainAction, removeDomainAction, saveCategoriesAction } from "./actions";

type Props = {
  params: Promise<{ childId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ERRORS: readonly string[] = ["invalid_category", "invalid_domain", "duplicate", "too_many", "not_found", "failed"];

export default async function Page({ params, searchParams }: Props) {
  const { childId } = await params;
  const query = await searchParams;
  const client = await createClient();
  const { data: child, error } = await client
    .from("children")
    .select("name, homework_categories, homework_domains")
    .eq("id", childId)
    .maybeSingle();
  if (!error && !child) notFound();

  const queryError = Array.isArray(query.error) ? query.error[0] : query.error;
  const known = queryError && ERRORS.includes(queryError) ? (queryError as HomeworkError) : null;
  return (
    <HomeworkSettingsView
      childId={childId}
      childName={child?.name ?? ""}
      categories={(child?.homework_categories ?? []) as Category[]}
      extraDomains={child?.homework_domains ?? []}
      error={error ? "failed" : known}
      actions={{ saveCategoriesAction, addDomainAction, removeDomainAction }}
    />
  );
}
