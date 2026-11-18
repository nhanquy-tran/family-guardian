import { createResendMailer } from "../../../../lib/alerts/resend";
import { buildDigest } from "../../../../lib/digest/content";
import { handleDigestSend } from "../../../../lib/digest/send";
import { createDigestSource, createDigestStore, createReportStore, createWeeklyTotals } from "../../../../lib/digest/supabase-store";
import { buildWeeklyReport } from "../../../../lib/digest/weekly-report";
import { handleWeeklyReportSend } from "../../../../lib/digest/weekly-report-send";
import { createAdminClient } from "../../../../lib/supabase/admin";

// The digest and the weekly report run back to back in one call.
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
  const secret = process.env.ALERT_CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const client = createAdminClient();
  const source = createDigestSource(client);
  const mailer = createResendMailer({ apiKey: apiKey ?? "", from: from ?? "" });
  const mailConfigured = Boolean(apiKey && from);
  const { status, body } = await handleDigestSend({
    authorization,
    secret,
    mailConfigured,
    appUrl,
    now: new Date(),
    store: createDigestStore(client),
    mailer,
    build: (family, period) =>
      buildDigest({ familyId: family.id, timezone: family.timezone, period, appUrl: appUrl ?? "", source }),
    log: ({ sent, skipped, failed }) => console.info(`digest-send sent=${sent} skipped=${skipped} failed=${failed}`),
  });
  if (status !== 200) return Response.json(body, { status });

  const totals = createWeeklyTotals(client);
  try {
    await handleWeeklyReportSend({
      authorization,
      secret,
      mailConfigured,
      appUrl,
      now: new Date(),
      store: createReportStore(client),
      mailer: { send: (m) => mailer.send(m) },
      build: (family, period) =>
        buildWeeklyReport({ familyId: family.id, timezone: family.timezone, period, appUrl: appUrl ?? "", source, totals }),
      log: ({ sent, skipped, failed }) => console.info(`weekly-report sent=${sent} skipped=${skipped} failed=${failed}`),
    });
  } catch {
    console.info("weekly-report failed");
  }
  return Response.json(body, { status });
}
