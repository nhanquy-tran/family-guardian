import { createResendMailer } from "../../../../lib/alerts/resend";
import { buildDigest } from "../../../../lib/digest/content";
import { handleDigestSend } from "../../../../lib/digest/send";
import { createDigestSource, createDigestStore } from "../../../../lib/digest/supabase-store";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
  const client = createAdminClient();
  const source = createDigestSource(client);
  const { status, body } = await handleDigestSend({
    authorization: request.headers.get("authorization"),
    secret: process.env.ALERT_CRON_SECRET,
    mailConfigured: Boolean(apiKey && from),
    appUrl,
    now: new Date(),
    store: createDigestStore(client),
    mailer: createResendMailer({ apiKey: apiKey ?? "", from: from ?? "" }),
    build: (family, period) =>
      buildDigest({ familyId: family.id, timezone: family.timezone, period, appUrl: appUrl ?? "", source }),
    log: ({ sent, skipped, failed }) => console.info(`digest-send sent=${sent} skipped=${skipped} failed=${failed}`),
  });
  return Response.json(body, { status });
}
