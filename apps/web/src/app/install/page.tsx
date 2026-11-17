import { InstallInstructions } from "../../components/install-instructions";
import { container, pageTitle } from "../../components/ui";

export const metadata = { title: "Install on your child's laptop | Family Guardian" };

export default function InstallPage() {
  return (
    <main className={`${container} flex max-w-2xl flex-col gap-6`}>
      <h1 className={pageTitle}>Install on your child&apos;s laptop</h1>
      <InstallInstructions />
    </main>
  );
}
