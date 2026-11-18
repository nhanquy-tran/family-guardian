export const LOCALES = ["en", "vi", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function pickLocale(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const candidates: { locale: Locale; q: number }[] = [];
  for (const entry of header.split(",")) {
    const [tag, ...params] = entry.split(";").map((part) => part.trim());
    const primary = tag.toLowerCase().split("-")[0];
    if (!isLocale(primary)) continue;
    let q = 1;
    const qParam = params.find((p) => p.toLowerCase().startsWith("q="));
    if (qParam) q = Number(qParam.slice(2));
    if (!Number.isFinite(q) || q <= 0) continue;
    candidates.push({ locale: primary, q });
  }
  candidates.sort((a, b) => b.q - a.q);
  return candidates[0]?.locale ?? DEFAULT_LOCALE;
}

export function localePath(locale: Locale, rest = ""): string {
  if (!rest) return `/${locale}`;
  return `/${locale}${rest.startsWith("/") ? rest : `/${rest}`}`;
}
