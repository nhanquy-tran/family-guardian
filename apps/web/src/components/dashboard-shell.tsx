import Link from "next/link";
import type { ReactNode } from "react";

export const DASHBOARD_NAV: { label: string; href: string }[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Children", href: "/dashboard/children" },
  { label: "Devices", href: "/dashboard/devices" },
  { label: "Install", href: "/dashboard/install" },
];

export function DashboardShell({ familyName, children }: { familyName: string; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-4xl p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <span className="text-lg font-semibold">{familyName}</span>
        <form method="post" action="/auth/sign-out">
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </header>
      <nav className="flex gap-4 py-4">
        {DASHBOARD_NAV.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
