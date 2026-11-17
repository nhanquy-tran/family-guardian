"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLink, navLinkCurrent } from "./ui";

export function DashboardNav({
  items,
  currentPath,
}: {
  items: { label: string; href: string }[];
  currentPath?: string;
}) {
  const hookPath = usePathname();
  const path = currentPath ?? hookPath;
  const isCurrent = (href: string): boolean =>
    path !== null && path !== undefined && (href === "/dashboard" ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {items.map((item) => {
        const current = isCurrent(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={current ? navLinkCurrent : navLink}
            {...(current ? { "aria-current": "page" as const } : {})}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
