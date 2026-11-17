"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { removeDevice, renameDevice } from "../../../lib/devices/devices";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/dashboard/devices";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function renameDeviceAction(formData: FormData): Promise<void> {
  const client = await createClient();
  const result = await renameDevice(client, field(formData, "deviceId"), field(formData, "name"));
  revalidatePath(PATH);
  redirect(result.ok ? PATH : `${PATH}?error=${result.error}`);
}

export async function removeDeviceAction(formData: FormData): Promise<void> {
  const client = await createClient();
  const result = await removeDevice(client, field(formData, "deviceId"));
  revalidatePath(PATH);
  redirect(result.ok ? PATH : `${PATH}?error=${result.error}`);
}
