import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "../lib/i18n/locale";
import { SITE_URL } from "../lib/site";

const PAGES = ["setup", "faq", "help"];

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    ...LOCALES.map((l) => localePath(l)),
    ...PAGES.flatMap((p) => LOCALES.map((l) => localePath(l, p))),
    "/privacy",
  ];
  return paths.map((path) => ({ url: `${SITE_URL}${path}` }));
}
