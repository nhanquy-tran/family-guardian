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

export async function listDevicesByChild(_client: SupabaseClient): Promise<ChildDevices[] | null> {
  throw new Error("not implemented");
}

export async function renameDevice(
  _client: SupabaseClient,
  _id: string,
  _rawName: string,
): Promise<{ ok: true } | { ok: false; error: "invalid-name" | "failed" }> {
  throw new Error("not implemented");
}

export async function removeDevice(
  _client: SupabaseClient,
  _id: string,
): Promise<{ ok: true } | { ok: false; error: "failed" }> {
  throw new Error("not implemented");
}

export function deviceErrorMessage(_code: string | undefined): string | null {
  throw new Error("not implemented");
}
