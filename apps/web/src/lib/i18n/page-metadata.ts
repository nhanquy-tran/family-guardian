import type { Metadata } from "next";
import { SITE_URL } from "../site";
import { LOCALES, localePath, type Locale } from "./locale";

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
  };
}
