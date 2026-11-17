import type { SupabaseClient } from "@supabase/supabase-js";

export type DeviceRow = {
  id: string;
  name: string | null;
  browser: string;
  os: string;
  extension_version: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export type ChildDevices = { id: string; name: string; devices: DeviceRow[] };

export async function listDevicesByChild(client: SupabaseClient): Promise<ChildDevices[] | null> {
  const { data, error } = await client
    .from("children")
    .select("id, name, devices(id, name, browser, os, extension_version, last_seen_at, created_at)")
    .order("name");
  if (error || !data) return null;
  return (data as ChildDevices[]).map((child) => ({
    ...child,
    devices: [...child.devices].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));
}

export async function renameDevice(
  client: SupabaseClient,
  id: string,
  rawName: string,
): Promise<{ ok: true } | { ok: false; error: "invalid-name" | "failed" }> {
  const name = rawName.trim();
  if (name.length < 1 || name.length > 40) return { ok: false, error: "invalid-name" };
  const { data, error } = await client.from("devices").update({ name }).eq("id", id).select("id");
  if (error || !data || data.length === 0) return { ok: false, error: "failed" };
  return { ok: true };
}

export async function removeDevice(
  client: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: "failed" }> {
  const { data, error } = await client.from("devices").delete().eq("id", id).select("id");
  if (error || !data || data.length === 0) return { ok: false, error: "failed" };
  return { ok: true };
}

const MESSAGES: Record<string, string> = {
  "invalid-name": "Name must be 1 to 40 characters.",
  failed: "Something went wrong. Please try again.",
  load: "Could not load devices. Please reload the page.",
};

export function deviceErrorMessage(code: string | undefined): string | null {
  return code !== undefined && Object.hasOwn(MESSAGES, code) ? (MESSAGES[code] ?? null) : null;
}
