import { InstallInstructions } from "../../components/install-instructions";

export const metadata = { title: "Install on your child's laptop | Family Guardian" };

export default function InstallPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold">Install on your child&apos;s laptop</h1>
      <InstallInstructions />
    </main>
  );
}
