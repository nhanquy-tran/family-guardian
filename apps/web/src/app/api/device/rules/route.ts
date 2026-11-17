import { handleRules } from "../../../../lib/device/rules-endpoint";
import { createRulesStore } from "../../../../lib/device/supabase-store";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function GET(request: Request): Promise<Response> {
  const { status, body, headers } = await handleRules({
    authorization: request.headers.get("authorization"),
    store: createRulesStore(createAdminClient()),
  });
  return Response.json(body, { status, headers });
}
