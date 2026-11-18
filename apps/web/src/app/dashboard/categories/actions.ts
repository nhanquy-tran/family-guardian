"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  removeCategoryOverride,
  saveCategoryOverride,
  type CategoryOverrideResult,
} from "../../../lib/category-overrides";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/dashboard/categories";
const field = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function finish(result: CategoryOverrideResult): never {
  if (result.ok) {
    revalidatePath(PATH);
    redirect(PATH);
  }
  redirect(`${PATH}?error=${result.error}`);
}

export async function saveAction(formData: FormData): Promise<void> {
  finish(await saveCategoryOverride(await createClient(), field(formData, "domain"), field(formData, "category")));
}

export async function removeAction(formData: FormData): Promise<void> {
  finish(await removeCategoryOverride(await createClient(), field(formData, "id")));
}
