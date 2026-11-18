import type { Metadata } from "next";
import { SITE_URL } from "../site";
import { LOCALES, localePath, type Locale } from "./locale";

export const OG_LOCALE: Record<Locale, string> = { en: "en_US", vi: "vi_VN", zh: "zh_CN" };

export function pageMetadata(locale: Locale, page: string, meta: { title: string; description: string }): Metadata {
  const url = (l: Locale) => `${SITE_URL}${localePath(l, page)}`;
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: url(locale),
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, url(l)])),
        "x-default": url("en"),
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: url(locale),
      siteName: "Family Guardian",
      type: "website",
      locale: OG_LOCALE[locale],
    },
  };
}
