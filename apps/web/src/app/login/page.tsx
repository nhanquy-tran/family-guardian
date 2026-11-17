import { LoginForm } from "@/components/login-form";
import { pageTitle } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-4 p-4 sm:p-6">
      <h1 className={pageTitle}>Family Guardian</h1>
      <LoginForm error={error === "auth" ? "auth" : undefined} />
    </main>
  );
}
