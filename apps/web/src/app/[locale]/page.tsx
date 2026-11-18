import { notFound } from "next/navigation";
import { Home } from "../../components/site/home";
import { LOCALES, isLocale } from "../../lib/i18n/locale";
import { getMessages } from "../../lib/i18n/messages";

export const dynamicParams = false;

export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Home locale={locale} messages={getMessages(locale)} />;
}
