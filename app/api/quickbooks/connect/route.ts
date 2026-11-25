import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { loadContext } from "@/lib/data/context";
import { authorizeUrl, quickbooksConfigured } from "@/lib/integrations/quickbooks";

// Step 1 of "Connect QuickBooks": send the user to Intuit to sign in and pick their company.
export async function GET(request: Request) {
  const ctx = await loadContext();
  if (!ctx.repo) return NextResponse.redirect(new URL("/login", request.url));
  if (!quickbooksConfigured()) return NextResponse.redirect(new URL("/settings/connections?qbo=not-configured", request.url));
  if (ctx.user && "role" in ctx.user && !["owner", "office_manager"].includes(ctx.user.role)) {
    return NextResponse.redirect(new URL("/settings/connections?qbo=not-allowed", request.url));
  }
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("qbo_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return res;
}
