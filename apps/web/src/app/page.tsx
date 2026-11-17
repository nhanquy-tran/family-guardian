import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
      <h1 className="text-4xl font-semibold">Family Guardian</h1>
      <p className="text-lg text-neutral-600">
        See which websites your child uses and for how long, block the ones you choose, and get a daily focus score.
        Only domains and time are collected.
      </p>
      <Link href="/login" className="text-sm underline">
        Sign in
      </Link>
    </main>
  );
}
