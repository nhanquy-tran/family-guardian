import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SetupGuide } from "../../../components/site/setup-guide";
import { LOCALES, isLocale } from "../../../lib/i18n/locale";
import { getMessages } from "../../../lib/i18n/messages";
import { pageMetadata } from "../../../lib/i18n/page-metadata";

export const dynamicParams = false;

export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return pageMetadata(locale, "setup", getMessages(locale).setup.meta);
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SetupGuide locale={locale} messages={getMessages(locale)} />;
}
