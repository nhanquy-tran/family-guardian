import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { DASHBOARD_NAV, DashboardNav } from "./dashboard-nav";
import { NavigationOverlay } from "./navigation-overlay";
import { buttonSecondary, container, navLink } from "./ui";

export { DASHBOARD_NAV };

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
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-ground/80 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={28} height={28} loading="lazy" />
            Family Guardian
          </span>
          <DashboardNav currentPath={currentPath} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink-2">{familyName}</span>
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
      <Suspense>
        <NavigationOverlay />
      </Suspense>
    </div>
  );
}
