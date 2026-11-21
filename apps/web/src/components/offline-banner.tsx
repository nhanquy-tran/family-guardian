import { loadActiveOfflineAlerts, type BannerAlert } from "../lib/alerts/banner";
import { loadSiteAccessLost } from "../lib/alerts/site-access-banner";
import { createClient } from "../lib/supabase/server";
import { alertWarning } from "./ui";

function formatUtc(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function OfflineBannerView({
  offline,
  siteAccessLost,
}: {
  offline: BannerAlert[];
  siteAccessLost: string[];
}): React.ReactNode {
  if (offline.length === 0 && siteAccessLost.length === 0) return null;
  return (
    <div className={`${alertWarning} mb-4 space-y-1`} role="alert">
      {offline.map((a) => (
        <p key={a.id}>
          {a.devices?.children?.name ?? "A child"}&apos;s {a.devices?.browser} on {a.devices?.os} has not reported
          since {formatUtc(a.incident_last_seen_at)}
        </p>
      ))}
      {siteAccessLost.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export async function OfflineBanner() {
  const client = await createClient();
  const [offline, siteAccessLost] = await Promise.all([loadActiveOfflineAlerts(client), loadSiteAccessLost(client)]);
  return <OfflineBannerView offline={offline} siteAccessLost={siteAccessLost} />;
}
