import "server-only";
import { extractInvoice, ExtractionError, isSupportedType, type ExtractedInvoice } from "@/lib/ai/extract-invoice";
import { isValidISODate, todayISO } from "@/lib/dates";
import { suggestJob } from "@/lib/jobmatch";
import { toCents } from "@/lib/money";
import type { Repo } from "@/lib/data/repo";
import type { Invoice, Job, LineItem } from "@/lib/types";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Turn the AI's answer into invoice fields (cents, checked dates, consistent totals). */
export function fieldsFromExtraction(x: ExtractedInvoice, jobs: Job[]): Partial<Invoice> {
  const fixSign = (c: number) => (x.is_credit_memo && c > 0 ? -c : c);

  const lineItems: LineItem[] = x.line_items.map((l) => ({
    description: l.description.slice(0, 500),
    quantity: l.quantity,
    unitPriceCents: toCents(l.unit_price),
    amountCents: fixSign(toCents(l.amount) ?? 0),
  }));
  const lineSum = lineItems.reduce((s, l) => s + l.amountCents, 0);

  let subtotal = x.subtotal !== null ? fixSign(toCents(x.subtotal)!) : lineSum;
  let tax = x.tax !== null ? fixSign(toCents(x.tax)!) : null;
  let total = x.total !== null ? fixSign(toCents(x.total)!) : null;
  if (total === null) total = subtotal + (tax ?? 0);
  if (tax === null) tax = total - subtotal;
  if (subtotal === 0 && lineItems.length === 0) subtotal = total - tax;

  const suggestion = suggestJob({ shipTo: x.ship_to, jobReference: x.job_reference }, jobs);
  const date = (s: string | null) => (isValidISODate(s) ? s : null);

  return {
    vendorName: x.vendor_name?.trim().slice(0, 200) || null,
    invoiceNumber: x.invoice_number?.trim().slice(0, 100) || null,
    invoiceDate: date(x.invoice_date),
    dueDate: date(x.due_date),
    shipTo: [x.ship_to, x.job_reference && !x.ship_to?.includes(x.job_reference) ? `Ref: ${x.job_reference}` : null]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 500) || null,
    lineItems,
    subtotalCents: subtotal,
    taxCents: tax,
    totalCents: total,
    isCreditMemo: x.is_credit_memo,
    isFinanceCharge: x.is_finance_charge,
    discountPercent: x.early_pay_discount_percent,
    discountDueDate: date(x.discount_due_date),
    costType: x.is_finance_charge ? "Finance charge" : x.suggested_cost_type,
    suggestedJobId: suggestion?.jobId ?? null,
    jobId: suggestion?.jobId ?? null, // pre-selected; a person still confirms
  };
}

/** Run AI reading on an invoice that already has its file stored. Never throws for AI problems. */
export async function runExtraction(repo: Repo, invoice: Invoice, bytes?: Uint8Array): Promise<void> {
  try {
    if (!invoice.filePath || !invoice.fileMime || !isSupportedType(invoice.fileMime)) {
      throw new ExtractionError("This file type can't be read automatically. Fill in the fields by hand.");
    }
    const data = bytes ?? (await repo.downloadFile(invoice.filePath))?.bytes;
    if (!data) throw new ExtractionError("The original file is missing.");

    const extracted = await extractInvoice(data, invoice.fileMime, todayISO());
    if (!extracted.is_invoice) {
      await repo.updateInvoice(invoice.id, {
        status: "Needs review",
        extraction: extracted,
        extractionError: "This doesn't look like a supplier invoice. Check it, then fill in or delete it.",
      });
      return;
    }
    const fields = fieldsFromExtraction(extracted, await repo.listJobs());
    const vendor = fields.vendorName ? await repo.ensureVendor(fields.vendorName) : null;
    await repo.updateInvoice(invoice.id, {
      ...fields,
      vendorId: vendor?.id ?? null,
      vendorName: vendor?.name ?? fields.vendorName,
      status: "Needs review",
      extraction: extracted,
      extractionError: null,
    });
  } catch (err) {
    const message = err instanceof ExtractionError ? err.message : "Something went wrong reading this invoice. Fill in the fields by hand.";
    if (!(err instanceof ExtractionError)) console.error("Invoice extraction failed", err);
    await repo.updateInvoice(invoice.id, { status: "Needs review", extractionError: message });
  }
}

/** Store the original file, create the invoice as "Received", then read it with AI. */
export async function receiveInvoiceFile(
  repo: Repo,
  file: { name: string; type: string; bytes: Uint8Array },
  source: "upload" | "email",
): Promise<Invoice> {
  const mime = file.type || "application/octet-stream";
  const path = await repo.uploadFile(file.name, mime, file.bytes);
  const invoice = await repo.createInvoice({
    status: "Received",
    filePath: path,
    fileName: file.name.slice(0, 200),
    fileMime: mime,
    source,
  });
  await runExtraction(repo, invoice, file.bytes);
  return invoice;
}
