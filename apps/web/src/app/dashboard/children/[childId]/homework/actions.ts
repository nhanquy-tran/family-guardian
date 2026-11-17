"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addHomeworkDomain,
  removeHomeworkDomain,
  saveHomeworkCategories,
  type HomeworkResult,
} from "../../../../../lib/homework";
import { createClient } from "../../../../../lib/supabase/server";

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "");
const pathFor = (childId: string) => `/dashboard/children/${encodeURIComponent(childId)}/homework`;

function finish(childId: string, result: HomeworkResult): never {
  const path = pathFor(childId);
  if (result.ok) {
    revalidatePath(path);
    revalidatePath("/dashboard");
    redirect(path);
  }
  redirect(`${path}?error=${result.error}`);
}

export async function saveCategoriesAction(formData: FormData): Promise<void> {
  const childId = field(formData, "childId");
  const categories = formData.getAll("category").map(String);
  finish(childId, await saveHomeworkCategories(await createClient(), childId, categories));
}

export async function addDomainAction(formData: FormData): Promise<void> {
  const childId = field(formData, "childId");
  finish(childId, await addHomeworkDomain(await createClient(), childId, field(formData, "domain")));
}

export async function removeDomainAction(formData: FormData): Promise<void> {
  const childId = field(formData, "childId");
  finish(childId, await removeHomeworkDomain(await createClient(), childId, field(formData, "domain")));
}
