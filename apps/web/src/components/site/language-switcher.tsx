"use client";
import { usePathname } from "next/navigation";
import { LOCALES, type Locale } from "../../lib/i18n/locale";
import { navLink, navLinkCurrent } from "../ui";

const NAMES: Record<Locale, string> = { en: "English", vi: "Tiếng Việt", zh: "简体中文" };

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const rest = pathname ? (/^\/[^/]+(\/.*)?$/.exec(pathname)?.[1] ?? "") : "";
  return (
    <nav aria-label="Language" className="flex flex-wrap gap-1">
      {LOCALES.map((l) => (
        <a
          key={l}
          href={`/${l}${rest}`}
          lang={l}
          {...{ hreflang: l }}
          aria-current={l === locale ? "page" : undefined}
          className={l === locale ? `${navLink} ${navLinkCurrent}` : navLink}
        >
          {NAMES[l]}
        </a>
      ))}
    </nav>
  );
}
