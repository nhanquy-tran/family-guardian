export const dynamicParams = true;

export function generateStaticParams(): { locale: string }[] {
  return [];
}

export default async function LocalePage(): Promise<never> {
  throw new Error("not implemented");
}
