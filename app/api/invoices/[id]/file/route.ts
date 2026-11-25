import { NextResponse } from "next/server";
import { loadContext } from "@/lib/data/context";

// Streams the original invoice file. Only works for invoices in the user's own company.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadContext();
  if (!ctx.repo) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const inv = await ctx.repo.getInvoice(id);
  if (!inv?.filePath) return NextResponse.json({ error: "No file for this invoice" }, { status: 404 });
  const file = await ctx.repo.downloadFile(inv.filePath);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  // Only show inline for safe types; anything else downloads.
  const inlineSafe = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.mime);
  const name = (inv.fileName ?? "invoice").replace(/["\r\n]/g, "");
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": inlineSafe ? file.mime : "application/octet-stream",
      "Content-Disposition": `${inlineSafe ? "inline" : "attachment"}; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
