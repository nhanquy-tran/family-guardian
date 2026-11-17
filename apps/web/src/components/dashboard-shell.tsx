import Link from "next/link";
import type { ReactNode } from "react";
import { buttonPrimary, container } from "./ui";

export const DASHBOARD_NAV: { label: string; href: string }[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Children", href: "/dashboard/children" },
  { label: "Devices", href: "/dashboard/devices" },
  { label: "Install", href: "/dashboard/install" },
];

export function DashboardShell({
  familyName,
  children,
}: {
  familyName: string;
  currentPath?: string;
  children?: ReactNode;
}) {
  return (
    <div className={container}>
      <header className="flex items-center justify-between gap-4">
        <span className="text-xl font-semibold">{familyName}</span>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings" className="px-2 py-2 text-sm font-medium">
            Settings
          </Link>
          <form method="post" action="/auth/sign-out">
            <button type="submit" className={buttonPrimary}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      <nav className="my-4 flex flex-wrap gap-x-4 gap-y-2">
        {DASHBOARD_NAV.map((item) => (
          <Link key={item.href} href={item.href} className="px-2 py-2 text-sm font-medium">
            {item.label}
          </Link>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
