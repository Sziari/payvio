import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { features } from "@/config/features";
import { isDemo } from "@/lib/env";
import { isSupportedType } from "@/lib/ai/extract-invoice";
import { MAX_FILE_BYTES, receiveInvoiceFile } from "@/lib/invoices/process";
import { SupabaseRepo } from "@/lib/data/supabase";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const maxDuration = 300;

// Email-in invoices via Postmark inbound.
// Suppliers send to ap+<company-slug>@INBOUND_EMAIL_DOMAIN. Postmark posts the email here as JSON.
// Webhook URL to give Postmark: https://<your-app>/api/inbound/postmark?token=<INBOUND_EMAIL_SECRET>

type PostmarkAttachment = { Name: string; Content: string; ContentType: string; ContentLength: number };
type PostmarkInbound = {
  From?: string;
  Subject?: string;
  MailboxHash?: string; // the part after "+" in ap+slug@...
  ToFull?: { Email: string; MailboxHash?: string }[];
  Attachments?: PostmarkAttachment[];
};

function tokenOk(given: string | null) {
  const expected = process.env.INBOUND_EMAIL_SECRET ?? "";
  if (!given || !expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  if (!features.emailInbox) return NextResponse.json({ error: "Email inbox is turned off" }, { status: 404 });
  if (isDemo) return NextResponse.json({ error: "Email-in needs Supabase (not available in demo mode)" }, { status: 400 });
  if (!tokenOk(request.nextUrl.searchParams.get("token"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = (await request.json()) as PostmarkInbound;
  const slug = (email.MailboxHash || email.ToFull?.find((t) => t.MailboxHash)?.MailboxHash || "").toLowerCase().trim();
  // Always answer 200 for mail we won't process, so Postmark doesn't retry it forever.
  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) return NextResponse.json({ ok: true, skipped: "no company address" });

  const db = createSupabaseAdmin();
  const { data: company } = await db.from("companies").select("id").eq("inbound_slug", slug).maybeSingle();
  if (!company) return NextResponse.json({ ok: true, skipped: "unknown company" });

  // Server-side repo for that company (service role; every query is filtered by company_id)
  const repo = new SupabaseRepo(db, company.id);
  const created: string[] = [];
  for (const a of (email.Attachments ?? []).slice(0, 10)) {
    if (!isSupportedType(a.ContentType)) continue; // skips logos in signatures, .docx, etc.
    const bytes = new Uint8Array(Buffer.from(a.Content, "base64"));
    if (bytes.byteLength > MAX_FILE_BYTES || bytes.byteLength < 2_000) continue; // tiny images are usually logos
    const inv = await receiveInvoiceFile(repo, { name: a.Name || "invoice", type: a.ContentType, bytes }, "email");
    created.push(inv.id);
  }
  return NextResponse.json({ ok: true, invoices: created.length });
}
