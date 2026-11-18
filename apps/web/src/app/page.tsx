import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { localePath, pickLocale } from "../lib/i18n/locale";

export default async function RootPage() {
  const h = await headers();
  redirect(localePath(pickLocale(h.get("accept-language"))));
}
