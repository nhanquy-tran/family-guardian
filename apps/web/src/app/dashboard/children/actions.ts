"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generatePairingCode } from "@fg/shared";
import { addChild, deleteChild, renameChild, type ChildResult } from "../../../lib/children";
import { createPairingCode } from "../../../lib/pairing/create-code";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/dashboard/children";
const field = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function finish(result: ChildResult): never {
  if (result.ok) {
    revalidatePath(PATH);
    redirect(PATH);
  }
  redirect(`${PATH}?error=${encodeURIComponent(result.error)}`);
}

export async function addChildAction(formData: FormData): Promise<void> {
  finish(await addChild(await createClient(), field(formData, "name")));
}

export async function renameChildAction(formData: FormData): Promise<void> {
  finish(await renameChild(await createClient(), field(formData, "id"), field(formData, "name")));
}

export async function deleteChildAction(formData: FormData): Promise<void> {
  finish(await deleteChild(await createClient(), field(formData, "id")));
}

export async function createCodeAction(formData: FormData): Promise<void> {
  const childId = field(formData, "childId");
  const result = await createPairingCode(await createClient(), childId, {
    now: new Date(),
    generate: () => generatePairingCode(),
  });
  if (result.ok) {
    revalidatePath(PATH);
    redirect(PATH);
  }
  redirect(`${PATH}?pairError=${encodeURIComponent(childId)}&reason=${result.reason}`);
}
