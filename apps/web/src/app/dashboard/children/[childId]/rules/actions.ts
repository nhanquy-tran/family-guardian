"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addCategoryRule, addDomainRule, removeBlockRule, type BlockRuleResult } from "../../../../../lib/block-rules";
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

export async function removeRuleAction(formData: FormData): Promise<void> {
  const childId = field(formData, "childId");
  finish(childId, await removeBlockRule(await createClient(), field(formData, "ruleId")));
}
