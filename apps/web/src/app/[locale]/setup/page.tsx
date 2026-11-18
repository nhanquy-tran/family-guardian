export const dynamicParams = true;

export function generateStaticParams(): { locale: string }[] {
  throw new Error("not implemented");
}

export async function generateMetadata(_props: { params: Promise<{ locale: string }> }): Promise<never> {
  throw new Error("not implemented");
}

export default function Page(): never {
  throw new Error("not implemented");
}
