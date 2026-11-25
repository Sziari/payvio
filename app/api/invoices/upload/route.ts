import { NextResponse } from "next/server";
import { loadContext } from "@/lib/data/context";
import { isSupportedType } from "@/lib/ai/extract-invoice";
import { MAX_FILE_BYTES, receiveInvoiceFile } from "@/lib/invoices/process";

export const maxDuration = 300; // AI reading can take a while for long invoices

// Upload one or more invoice files (multipart form field "files").
export async function POST(request: Request) {
  const ctx = await loadContext();
  if (!ctx.repo) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "No files received." }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ error: "Upload up to 20 files at a time." }, { status: 400 });

  const results: { name: string; id?: string; error?: string }[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      results.push({ name: f.name, error: "File is larger than 20 MB." });
      continue;
    }
    if (!isSupportedType(f.type)) {
      results.push({ name: f.name, error: "Only PDF, JPG, PNG, WEBP or GIF files can be read." });
      continue;
    }
    const inv = await receiveInvoiceFile(
      ctx.repo,
      { name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) },
      "upload",
    );
    results.push({ name: f.name, id: inv.id });
  }
  return NextResponse.json({ results });
}
