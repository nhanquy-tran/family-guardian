import { NextResponse, type NextRequest } from "next/server";
import { startGoogleSignIn } from "@/lib/auth/flow";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const target = await startGoogleSignIn(await createClient(), origin);
  return NextResponse.redirect(new URL(target, origin), 303);
}
