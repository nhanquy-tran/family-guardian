import type { SupabaseClient } from "@supabase/supabase-js";

export type SiteAccessLostRow = {
  name: string | null;
  browser: string;
  os: string;
  children: { name: string } | null;
};

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function siteAccessLostLines(rows: SiteAccessLostRow[]): string[] {
  return [...rows]
    .sort(
      (a, b) =>
        cmp(a.children?.name ?? "", b.children?.name ?? "") ||
        cmp(a.browser, b.browser) ||
        cmp(a.name?.trim() ?? "", b.name?.trim() ?? ""),
    )
    .map((r) => {
      const label = r.name?.trim() || `${r.children?.name ?? "A child"}'s ${capitalize(r.browser)} on ${r.os}`;
      return `Blocking is off on ${label}: site access was turned off`;
    });
}

export async function loadSiteAccessLost(client: SupabaseClient): Promise<string[]> {
  try {
    const { data, error } = await client
      .from("devices")
      .select("name, browser, os, children(name)")
      .eq("site_access", false);
    if (error || !data) return [];
    return siteAccessLostLines(data as unknown as SiteAccessLostRow[]);
  } catch {
    return [];
  }
}
