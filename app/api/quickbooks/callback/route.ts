import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { loadContext } from "@/lib/data/context";
import { connectFromCallback } from "@/lib/integrations/quickbooks";

// Step 2: Intuit sends the user back here with a one-time code.
export async function GET(request: NextRequest) {
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/settings/connections?qbo=${status}`, request.url));
    res.cookies.delete("qbo_state");
    return res;
  };
  const p = request.nextUrl.searchParams;
  if (p.get("error")) return back("cancelled");

  const state = p.get("state") ?? "";
  const expected = request.cookies.get("qbo_state")?.value ?? "";
  const same = state.length > 0 && state.length === expected.length && timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  if (!same) return back("expired");

  const code = p.get("code");
  const realmId = p.get("realmId");
  if (!code || !realmId) return back("failed");

  const ctx = await loadContext();
  if (!ctx.repo) return NextResponse.redirect(new URL("/login", request.url));
  try {
    await connectFromCallback(ctx.repo.companyId, code, realmId);
  } catch (e) {
    console.error("QuickBooks connect failed", e);
    return back(e instanceof Error && e.message.includes("different company") ? "in-use" : "failed");
  }
  return back("connected");
}
