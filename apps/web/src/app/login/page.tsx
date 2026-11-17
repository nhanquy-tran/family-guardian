import { LoginForm } from "@/components/login-form";
import { container } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className={`${container} flex flex-col items-center justify-center`}>
      <LoginForm error={error === "auth" ? "auth" : undefined} />
    </main>
  );
}
