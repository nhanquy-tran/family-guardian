import type { ReactNode } from "react";

export const DASHBOARD_NAV: { label: string; href: string }[] = [];

export function DashboardShell(props: { familyName: string; children: ReactNode }): never {
  void props;
  throw new Error("not implemented");
}
