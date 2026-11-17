import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth/flow";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const target = await signOut(await createClient());
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), 303);
}
