export const LOCALES = ["en", "vi", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(_value: string): _value is Locale {
  throw new Error("not implemented");
}

export function pickLocale(_header: string | null): Locale {
  throw new Error("not implemented");
}

export function localePath(_locale: Locale, _rest?: string): string {
  throw new Error("not implemented");
}
