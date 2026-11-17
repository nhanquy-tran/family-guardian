import { NextResponse } from "next/server";
import { clientIp, pairDevice } from "../../../../lib/pairing/pair-device";
import { createAdminClient, createPairDeps } from "../../../../lib/supabase/admin";

export async function POST(request: Request): Promise<Response> {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Not JSON: pairDevice answers invalid_request after counting the attempt.
  }
  try {
    const deps = createPairDeps(createAdminClient());
    const result = await pairDevice(deps, clientIp(request.headers, console.warn), body);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
