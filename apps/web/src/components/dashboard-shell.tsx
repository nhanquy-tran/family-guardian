import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardNav } from "./dashboard-nav";
import { buttonSecondary, container, navLink } from "./ui";

export const DASHBOARD_NAV: { label: string; href: string }[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Children", href: "/dashboard/children" },
  { label: "Devices", href: "/dashboard/devices" },
  { label: "Install", href: "/dashboard/install" },
];

export function DashboardShell({
  familyName,
  currentPath,
  children,
}: {
  familyName: string;
  currentPath?: string;
  children?: ReactNode;
}) {
  return (
    <div className={container}>
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-ground/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={28} height={28} loading="lazy" className="size-7" />
          <span className="font-semibold tracking-tighter text-ink">Family Guardian</span>
        </div>
        <DashboardNav items={DASHBOARD_NAV} {...(currentPath ? { currentPath } : {})} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-2">{familyName}</span>
          <Link href="/dashboard/settings" className={navLink}>
            Settings
          </Link>
          <form method="post" action="/auth/sign-out">
            <button type="submit" className={buttonSecondary}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
