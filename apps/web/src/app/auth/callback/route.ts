import { NextResponse, type NextRequest } from "next/server";
import { completeSignIn } from "@/lib/auth/flow";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const target = await completeSignIn(await createClient(), request.nextUrl.searchParams.get("code"));
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), 303);
}
