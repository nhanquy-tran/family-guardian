"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addCategoryRule, addDomainRule, removeBlockRule, type BlockRuleResult } from "../../../../../lib/block-rules";
import { CATEGORIES } from "@fg/shared";
import { saveAllowedHours } from "../../../../../lib/allowed-hours";
import { saveDailyLimits } from "../../../../../lib/daily-limits";
import { createClient } from "../../../../../lib/supabase/server";

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "");
const pathFor = (childId: string) => `/dashboard/children/${encodeURIComponent(childId)}/rules`;

function finish(childId: string, result: BlockRuleResult): never {
  const path = pathFor(childId);
  if (result.ok) {
    revalidatePath(path);
    redirect(path);
  }
  redirect(`${path}?error=${result.error}`);
}

export async function addDomainAction(formData: FormData): Promise<void> {
  const childId = field(formData, "childId");
  finish(childId, await addDomainRule(await createClient(), childId, field(formData, "domain")));
}

export async function addCategoryAction(formData: FormData): Promise<void> {
  const childId = field(formData, "childId");
  finish(childId, await addCategoryRule(await createClient(), childId, field(formData, "category")));
}

export async function saveLimitsAction(formData: FormData): Promise<void> {
  const childId = field(formData, "childId");
  const values = Object.fromEntries(CATEGORIES.map((c) => [c, field(formData, `limit_${c}`)]));
  const result = await saveDailyLimits(await createClient(), childId, values);
  const path = pathFor(childId);
  if (result.ok) {
    revalidatePath(path);
    redirect(path);
  }
  redirect(`${path}?limitsError=${result.error}`);
}

export async function saveAllowedHoursAction(formData: FormData): Promise<void> {
  const childId = field(formData, "childId");
  const result = await saveAllowedHours(await createClient(), childId, {
    start: field(formData, "allowed_start"),
    end: field(formData, "allowed_end"),
  });
  const path = pathFor(childId);
  if (result.ok) {
    revalidatePath(path);
    redirect(path);
  }
  redirect(`${path}?hoursError=${result.error}`);
}

export async function removeRuleAction(formData: FormData): Promise<void> {
  const childId = field(formData, "childId");
  finish(childId, await removeBlockRule(await createClient(), field(formData, "ruleId")));
}
