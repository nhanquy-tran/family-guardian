"use client";
import { usePathname } from "next/navigation";
import type { Locale } from "../../lib/i18n/locale";

export function LanguageSwitcher(_props: { locale: Locale }): never {
  void usePathname;
  throw new Error("not implemented");
}
