import { notFound } from "next/navigation";
import { BlockRulesView } from "../../../../../components/block-rules-view";
import { listBlockRules } from "../../../../../lib/block-rules";
import { createClient } from "../../../../../lib/supabase/server";
import { addCategoryAction, addDomainAction, removeRuleAction } from "./actions";

type Props = {
  params: Promise<{ childId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { childId } = await params;
  const query = await searchParams;
  const client = await createClient();
  const { data: child } = await client.from("children").select("name").eq("id", childId).maybeSingle();
  if (!child) notFound();

  const listed = await listBlockRules(client, childId);
  const queryError = Array.isArray(query.error) ? query.error[0] : query.error;
  return (
    <BlockRulesView
      childId={childId}
      childName={child.name}
      rules={listed.ok ? listed.rules : []}
      error={listed.ok ? (queryError ?? null) : listed.error}
      actions={{ addDomainAction, addCategoryAction, removeRuleAction }}
    />
  );
}
