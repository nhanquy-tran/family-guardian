import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "../lib/i18n/locale";
import { SITE_URL } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [...LOCALES.map((l) => localePath(l)), "/privacy"].map((path) => ({ url: `${SITE_URL}${path}` }));
}
