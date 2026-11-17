"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { captureFamilyTimezone, saveDigestSettings } from "../../../lib/digest/settings";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/dashboard/settings";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveDigestSettingsAction(formData: FormData): Promise<void> {
  const hour = field(formData, "hour");
  const client = await createClient();
  const result = await saveDigestSettings(client, {
    frequency: field(formData, "frequency"),
    hour: hour === "" ? Number.NaN : Number(hour),
    timezone: field(formData, "timezone"),
  });
  revalidatePath(PATH);
  redirect(result.ok ? `${PATH}?saved=1` : `${PATH}?error=${result.error}`);
}

export async function captureTimezoneAction(timezone: string): Promise<void> {
  await captureFamilyTimezone(await createClient(), timezone);
}
