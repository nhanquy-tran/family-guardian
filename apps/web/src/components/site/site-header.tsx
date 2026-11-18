import Link from "next/link";
import type { Locale } from "../../lib/i18n/locale";
import type { Messages } from "../../lib/i18n/messages";
import { buttonPrimary, navLink } from "../ui";

export function SiteHeader({ locale, messages }: { locale: Locale; messages: Messages }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 p-4 sm:px-6">
      <a href={`/${locale}`} className={`${navLink} gap-2 font-semibold text-ink`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={28} height={28} />
        {messages.nav.brand}
      </a>
      <Link href="/login" className={buttonPrimary}>
        {messages.nav.signIn}
      </Link>
    </header>
  );
}
