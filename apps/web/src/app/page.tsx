import Link from "next/link";
import { buttonPrimary, buttonSecondary, card, container, pageTitle } from "@/components/ui";

export default function Home() {
  return (
    <main className={`${container} flex max-w-2xl flex-col justify-center`}>
      <div className={`${card} flex flex-col gap-6`}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={40} height={40} />
          <h1 className={`${pageTitle} mb-0`}>Family Guardian</h1>
        </div>
        <p className="text-lg text-ink-2">
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
