import type { Metadata } from "next";
import type { ReactNode } from "react";

export async function generateMetadata(_props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  throw new Error("not implemented");
}

export default async function LocaleLayout(_props: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}): Promise<never> {
  throw new Error("not implemented");
}
