import { handleOfflineAlerts } from "../../../../lib/alerts/offline";
import { createOfflineAlertStore } from "../../../../lib/alerts/supabase-store";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: Request): Promise<Response> {
  const { status, body } = await handleOfflineAlerts({
    authorization: request.headers.get("authorization"),
    secret: process.env.ALERT_CRON_SECRET,
    now: new Date(),
    store: createOfflineAlertStore(createAdminClient()),
    log: ({ recorded, skipped }) => console.info(`offline-alerts recorded=${recorded} skipped=${skipped}`),
  });
  return Response.json(body, { status });
}
