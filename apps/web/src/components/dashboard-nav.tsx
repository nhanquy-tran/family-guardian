"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLink, navLinkCurrent } from "./ui";

export const DASHBOARD_NAV: { label: string; href: string }[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Children", href: "/dashboard/children" },
  { label: "Categories", href: "/dashboard/categories" },
  { label: "Devices", href: "/dashboard/devices" },
  { label: "Install", href: "/dashboard/install" },
];

function isCurrent(href: string, path: string | null | undefined): boolean {
  if (!path) return false;
  if (href === "/dashboard") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

export function DashboardNav({ currentPath }: { currentPath?: string }) {
  const hookPath = usePathname();
  const path = currentPath ?? hookPath;
  return (
    <nav className="flex flex-wrap gap-2">
      {DASHBOARD_NAV.map((item) => {
        const current = isCurrent(item.href, path);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={current ? `${navLink} ${navLinkCurrent}` : navLink}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
