import { notFound } from "next/navigation";
import { BlockRulesView } from "../../../../../components/block-rules-view";
import { listBlockRules } from "../../../../../lib/block-rules";
import { createClient } from "../../../../../lib/supabase/server";
import { DailyLimitsCard } from "../../../../../components/daily-limits-card";
import { listDailyLimits } from "../../../../../lib/daily-limits";
import { AllowedHoursCard } from "../../../../../components/allowed-hours-card";
import { addCategoryAction, addDomainAction, removeRuleAction, saveAllowedHoursAction, saveLimitsAction } from "./actions";

type Props = {
  params: Promise<{ childId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { childId } = await params;
  const query = await searchParams;
  const client = await createClient();
  const { data: child } = await client.from("children").select("name, allowed_start, allowed_end").eq("id", childId).maybeSingle();
  if (!child) notFound();

  const listed = await listBlockRules(client, childId);
  const queryError = Array.isArray(query.error) ? query.error[0] : query.error;
  const limits = await listDailyLimits(client, childId);
  const limitsQueryError = Array.isArray(query.limitsError) ? query.limitsError[0] : query.limitsError;
  const hoursQueryError = Array.isArray(query.hoursError) ? query.hoursError[0] : query.hoursError;
  const hours =
    typeof child.allowed_start === "string" && typeof child.allowed_end === "string"
      ? { start: child.allowed_start, end: child.allowed_end }
      : null;
  return (
    <>
      <BlockRulesView
        childId={childId}
        childName={child.name}
        rules={listed.ok ? listed.rules : []}
        error={listed.ok ? (queryError ?? null) : listed.error}
        actions={{ addDomainAction, addCategoryAction, removeRuleAction }}
      />
      <div className="mx-auto w-full max-w-6xl p-4 pt-0 sm:p-6 sm:pt-0">
        <DailyLimitsCard
          childId={childId}
          limits={limits.ok ? limits.limits : []}
          error={limits.ok ? (limitsQueryError ?? null) : limits.error}
          action={saveLimitsAction}
        />
      </div>
      <div className="mx-auto w-full max-w-6xl p-4 pt-0 sm:p-6 sm:pt-0">
        <AllowedHoursCard
          childId={childId}
          hours={hours}
          error={hoursQueryError ?? null}
          action={saveAllowedHoursAction}
        />
      </div>
    </>
  );
}
