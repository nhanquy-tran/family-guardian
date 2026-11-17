import { handleOfflineAlerts } from "../../../../lib/alerts/offline";
import { createResendMailer } from "../../../../lib/alerts/resend";
import { createOfflineAlertStore } from "../../../../lib/alerts/supabase-store";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  const { status, body } = await handleOfflineAlerts({
    authorization: request.headers.get("authorization"),
    secret: process.env.ALERT_CRON_SECRET,
    mailConfigured: Boolean(apiKey && from),
    now: new Date(),
    store: createOfflineAlertStore(createAdminClient()),
    mailer: createResendMailer({ apiKey: apiKey ?? "", from: from ?? "" }),
    log: ({ sent, skipped, failed, throttled }) =>
      console.info(`offline-alerts sent=${sent} skipped=${skipped} failed=${failed} throttled=${throttled}`),
  });
  return Response.json(body, { status });
}
