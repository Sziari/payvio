import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

// Supabase sends people here from the "confirm your email" link.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const db = await createSupabaseServer();
    await db.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/onboarding", request.url));
}
