import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "../../components/site/language-switcher";
import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { LOCALES, isLocale, localePath, type Locale } from "../../lib/i18n/locale";
import { getMessages } from "../../lib/i18n/messages";
import { SITE_URL } from "../../lib/site";

const OG_LOCALE: Record<Locale, string> = { en: "en_US", vi: "vi_VN", zh: "zh_CN" };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { meta } = getMessages(locale);
  const url = `${SITE_URL}${localePath(locale)}`;
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${localePath(l)}`])),
        "x-default": `${SITE_URL}${localePath("en")}`,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: "Family Guardian",
      type: "website",
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  return (
    <div lang={locale} className="flex min-h-full flex-1 flex-col">
      <SiteHeader locale={locale} messages={messages} />
      <div className="flex-1">{children}</div>
      <SiteFooter locale={locale} messages={messages} switcher={<LanguageSwitcher locale={locale} />} />
    </div>
  );
}
