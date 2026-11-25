import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

// Supabase sends people here from "confirm your email" and "reset password" links.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/onboarding";
  // Only allow paths on this site (no open redirects)
  const safeNext = /^\/[a-zA-Z0-9\-/]*$/.test(next) ? next : "/onboarding";
  if (code) {
    const db = await createSupabaseServer();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?link=expired", request.url));
  }
  return NextResponse.redirect(new URL(safeNext, request.url));
}
