import { NextResponse, type NextRequest } from "next/server";
import { completeSignIn } from "@/lib/auth/flow";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const target = await completeSignIn(await createClient(), searchParams.get("code"));
  return NextResponse.redirect(new URL(target, origin), 303);
}
