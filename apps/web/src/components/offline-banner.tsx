import { loadActiveOfflineAlerts } from "@/lib/alerts/banner";
import { createClient } from "@/lib/supabase/server";
import { alertWarning } from "./ui";

function formatUtc(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export async function OfflineBanner() {
  const alerts = await loadActiveOfflineAlerts(await createClient());
  if (alerts.length === 0) return null;
  return (
    <div className={`${alertWarning} mb-4 space-y-1`} role="alert">
      {alerts.map((a) => (
        <p key={a.id}>
          {a.devices?.children?.name ?? "A child"}&apos;s {a.devices?.browser} on {a.devices?.os} has not reported
          since {formatUtc(a.incident_last_seen_at)}
        </p>
      ))}
    </div>
  );
}
