import type { Locale } from "./locale";

export type Messages = Record<string, unknown>;

export function getMessages(_locale: Locale): Messages {
  throw new Error("not implemented");
}
