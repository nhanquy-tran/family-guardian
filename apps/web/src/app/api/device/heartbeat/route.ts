import { handleHeartbeat } from "../../../../lib/device/heartbeat";
import { createHeartbeatStore } from "../../../../lib/device/supabase-store";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: Request): Promise<Response> {
  const { status, body } = await handleHeartbeat({
    authorization: request.headers.get("authorization"),
    rawBody: await request.text(),
    now: new Date(),
    store: createHeartbeatStore(createAdminClient()),
    log: ({ accepted, skipped }) => console.info(`heartbeat accepted=${accepted} skipped=${skipped}`),
  });
  return Response.json(body, { status });
}
