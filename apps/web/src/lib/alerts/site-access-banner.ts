import type { SupabaseClient } from "@supabase/supabase-js";

export type SiteAccessLostRow = {
  name: string | null;
  browser: string;
  os: string;
  children: { name: string } | null;
};

export function siteAccessLostLines(_rows: SiteAccessLostRow[]): string[] {
  throw new Error("not implemented");
}

export async function loadSiteAccessLost(_client: SupabaseClient): Promise<string[]> {
  throw new Error("not implemented");
}
