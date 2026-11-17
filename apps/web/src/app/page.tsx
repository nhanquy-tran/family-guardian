import Link from "next/link";
import { buttonPrimary, buttonSecondary, card, container, pageTitle } from "../components/ui";

export default function Home() {
  return (
    <main className={`${container} flex max-w-2xl flex-col justify-center`}>
      <div className={`${card} flex flex-col gap-4`}>
        <h1 className={pageTitle}>Family Guardian</h1>
        <p className="text-base text-ink-2">
          See which websites your child uses and for how long, block the ones you choose, and get a daily focus score.
          Only domains and time are collected.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/login" className={buttonPrimary}>
            Sign in
          </Link>
          <Link href="/install" className={buttonSecondary}>
            Install on your child&apos;s laptop
          </Link>
        </div>
      </div>
    </main>
  );
}
