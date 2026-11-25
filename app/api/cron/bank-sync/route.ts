import { NextResponse } from "next/server";
import { isDemo } from "@/lib/env";
import { plaidConfigured, syncPlaidConnection } from "@/lib/integrations/plaid";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const maxDuration = 300;

// Runs every morning (vercel.json) to refresh every company's bank balances.
// Vercel sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isDemo || !plaidConfigured()) return NextResponse.json({ ok: true, skipped: true });

  const db = createSupabaseAdmin();
  const { data } = await db.from("connections").select("id, company_id").eq("provider", "plaid").neq("status", "needs_reauth");
  let synced = 0;
  let failed = 0;
  for (const c of data ?? []) {
    try {
      await syncPlaidConnection(c.company_id, c.id);
      synced++;
    } catch {
      failed++; // error is saved on the connection and shown in Settings
    }
  }
  return NextResponse.json({ ok: true, synced, failed });
}
