import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "../../lib/i18n/locale";
import type { Messages } from "../../lib/i18n/messages";
import { navLink } from "../ui";

export function SiteFooter({
  locale,
  messages,
  switcher,
}: {
  locale: Locale;
  messages: Messages;
  switcher: ReactNode;
}) {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line p-4 sm:px-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-2">{messages.footer.note}</p>
        <div className="flex flex-wrap gap-1">
          <Link href="/privacy" className={navLink}>
            {messages.footer.privacy}
          </Link>
          <a href={`/${locale}/setup`} className={navLink}>
            {messages.footer.setup}
          </a>
          <a href={`/${locale}/help`} className={navLink}>
            {messages.footer.help}
          </a>
          <a href={`/${locale}/faq`} className={navLink}>
            {messages.footer.faq}
          </a>
        </div>
      </div>
      {switcher}
    </footer>
  );
}
