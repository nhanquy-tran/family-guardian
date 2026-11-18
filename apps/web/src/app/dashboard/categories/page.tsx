import { CategoryOverridesView } from "../../../components/category-overrides-view";
import { normalizeBlockDomain } from "../../../lib/block-rules";
import { listCategoryOverrides } from "../../../lib/category-overrides";
import { createClient } from "../../../lib/supabase/server";
import { removeAction, saveAction } from "./actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function Page({ searchParams }: Props) {
  const query = await searchParams;
  const listed = await listCategoryOverrides(await createClient());
  const rawDomain = first(query.domain);
  return (
    <CategoryOverridesView
      overrides={listed.ok ? listed.overrides : []}
      error={listed.ok ? (first(query.error) ?? null) : listed.error}
      domain={rawDomain ? normalizeBlockDomain(rawDomain) : null}
      actions={{ saveAction, removeAction }}
    />
  );
}
