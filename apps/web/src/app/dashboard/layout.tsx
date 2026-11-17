import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { OfflineBanner } from "@/components/offline-banner";
import { DashboardShell } from "@/components/dashboard-shell";
import { getFamilyName } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const familyName = await getFamilyName(supabase);
  return (
    <DashboardShell familyName={familyName}>
      <OfflineBanner />
      {children}
    </DashboardShell>
  );
}
