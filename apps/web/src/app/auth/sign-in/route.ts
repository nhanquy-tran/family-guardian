import { NextResponse, type NextRequest } from "next/server";
import { startGoogleSignIn } from "@/lib/auth/flow";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const target = await startGoogleSignIn(await createClient(), request.nextUrl.origin);
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), 303);
}
