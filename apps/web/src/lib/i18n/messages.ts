import en from "../../messages/en.json";
import vi from "../../messages/vi.json";
import zh from "../../messages/zh.json";
import type { Locale } from "./locale";

export type Messages = typeof en;

const all: Record<Locale, Messages> = { en, vi, zh };

export function getMessages(locale: Locale): Messages {
  return all[locale];
}
