"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { costTypes, invoiceWorkflow, type InvoiceStatus } from "@/config/workflows";
import { requireContext } from "@/lib/data/context";
import { addApproval, checkConfirm, pendingApprovals, statusAfterReview } from "@/lib/approvals";
import { isValidISODate, todayISO } from "@/lib/dates";
import { toCents } from "@/lib/money";
import { runExtraction } from "@/lib/invoices/process";
import type { Invoice } from "@/lib/types";

const money = z.string().max(30);
const optDate = z.string().max(10).nullable().refine((s) => s === null || s === "" || isValidISODate(s), "Invalid date");

const InvoiceForm = z.object({
  vendorName: z.string().max(200),
  invoiceNumber: z.string().max(100),
  invoiceDate: optDate,
  dueDate: optDate,
  shipTo: z.string().max(500),
  jobId: z.string().max(100).nullable(),
  costType: z.enum(costTypes).nullable(),
  subtotal: money,
  tax: money,
  total: money,
  isCreditMemo: z.boolean(),
  isFinanceCharge: z.boolean(),
  discountPercent: z.string().max(10),
  discountDueDate: optDate,
  lineItems: z
    .array(
      z.object({
        description: z.string().max(500),
        quantity: z.string().max(20),
        unitPrice: money,
        amount: money,
        costType: z.enum(costTypes).nullable(),
      }),
    )
    .max(500),
});
export type InvoiceFormData = z.infer<typeof InvoiceForm>;
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function toPatch(data: InvoiceFormData): Promise<Partial<Invoice> | string> {
  const parsed = InvoiceForm.safeParse(data);
  if (!parsed.success) return "Some fields aren't valid. Check the dates and amounts.";
  const d = parsed.data;
  const total = toCents(d.total);
  if (total === null) return "Enter the invoice total.";
  const lineItems = d.lineItems
    .filter((l) => l.description.trim() || l.amount.trim())
    .map((l) => ({
      description: l.description.trim(),
      quantity: l.quantity.trim() === "" ? null : Number(l.quantity),
      unitPriceCents: toCents(l.unitPrice),
      amountCents: toCents(l.amount) ?? 0,
      costType: l.costType,
    }));
  if (lineItems.some((l) => l.quantity !== null && !Number.isFinite(l.quantity))) return "A line quantity isn't a number.";
  const discount = d.discountPercent.trim() === "" ? null : Number(d.discountPercent);
  if (discount !== null && (!Number.isFinite(discount) || discount < 0 || discount > 100)) return "Discount % must be 0-100.";

  return {
    vendorName: d.vendorName.trim() || null,
    invoiceNumber: d.invoiceNumber.trim() || null,
    invoiceDate: d.invoiceDate || null,
    dueDate: d.dueDate || null,
    shipTo: d.shipTo.trim() || null,
    jobId: d.jobId || null,
    costType: d.isFinanceCharge ? "Finance charge" : d.costType,
    subtotalCents: toCents(d.subtotal) ?? total - (toCents(d.tax) ?? 0),
    taxCents: toCents(d.tax) ?? 0,
    totalCents: total,
    isCreditMemo: d.isCreditMemo,
    isFinanceCharge: d.isFinanceCharge,
    discountPercent: discount,
    discountDueDate: d.discountDueDate || null,
    lineItems,
  };
}

async function loadInvoice(id: string) {
  const ctx = await requireContext();
  const inv = await ctx.repo.getInvoice(id);
  if (!inv) throw new Error("Invoice not found");
  return { ...ctx, inv };
}

function refresh(id: string) {
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/jobs", "layout");
}

async function withVendor(repo: Awaited<ReturnType<typeof requireContext>>["repo"], patch: Partial<Invoice>) {
  if (!patch.vendorName) return { ...patch, vendorId: null };
  const v = await repo.ensureVendor(patch.vendorName);
  return { ...patch, vendorId: v.id, vendorName: v.name };
}

/** Save edits without confirming. */
export async function saveInvoice(id: string, data: InvoiceFormData): Promise<ActionResult> {
  const { repo, inv } = await loadInvoice(id);
  const patch = await toPatch(data);
  if (typeof patch === "string") return { ok: false, error: patch };
  // Changing the amount after approval restarts approvals.
  const resetApprovals = inv.confirmedAt && patch.totalCents !== inv.totalCents;
  await repo.updateInvoice(id, {
    ...(await withVendor(repo, patch)),
    ...(resetApprovals ? { approvals: [], status: statusAfterReview({ totalCents: patch.totalCents!, approvals: [] }) } : {}),
  });
  refresh(id);
  return { ok: true, message: resetApprovals ? "Saved. The amount changed, so approvals were reset." : "Saved." };
}

/** A person checked the AI's work: the invoice now counts toward job cost. */
export async function confirmInvoice(id: string, data: InvoiceFormData): Promise<ActionResult> {
  const { repo, user, inv } = await loadInvoice(id);
  const patch = await toPatch(data);
  if (typeof patch === "string") return { ok: false, error: patch };
  const check = checkConfirm({ jobId: patch.jobId ?? null, vendorName: patch.vendorName ?? null, totalCents: patch.totalCents! });
  if (!check.ok) return { ok: false, error: check.reason };

  const approvals = inv.approvals;
  await repo.updateInvoice(id, {
    ...(await withVendor(repo, patch)),
    confirmedAt: new Date().toISOString(),
    status: statusAfterReview({ totalCents: patch.totalCents!, approvals }),
    ...(repo.mode === "live" ? ({ confirmedBy: user.id } as object) : {}),
  });
  refresh(id);
  const pending = pendingApprovals({ totalCents: patch.totalCents!, approvals });
  return {
    ok: true,
    message: pending.length
      ? `Confirmed. Waiting for approval from: ${pending.map((p) => p.role.replace("_", " ")).join(", ")}.`
      : "Confirmed and approved.",
  };
}

export async function approveInvoice(id: string): Promise<ActionResult> {
  const { repo, user, inv } = await loadInvoice(id);
  if (!inv.confirmedAt) return { ok: false, error: "Confirm the invoice details first." };
  if (invoiceWorkflow.requireJobBeforeApproval && !inv.jobId) return { ok: false, error: "Pick a job first." };
  const approvals = addApproval(inv, user.id, user.role);
  if (!approvals) return { ok: false, error: "Your role can't approve the next step on this invoice." };
  await repo.updateInvoice(id, { approvals, status: statusAfterReview({ totalCents: inv.totalCents, approvals }) });
  refresh(id);
  return { ok: true, message: "Approved." };
}

export async function setInvoiceStatus(
  id: string,
  status: Extract<InvoiceStatus, "Scheduled" | "Paid" | "Disputed" | "Approved">,
  date?: string,
): Promise<ActionResult> {
  const { repo, inv } = await loadInvoice(id);
  if (!inv.confirmedAt) return { ok: false, error: "Confirm the invoice details first." };
  if ((status === "Scheduled" || status === "Paid") && pendingApprovals(inv).length) {
    return { ok: false, error: "This invoice still needs approval." };
  }
  if (date && !isValidISODate(date)) return { ok: false, error: "Pick a valid date." };
  const patch: Partial<Invoice> = { status };
  if (status === "Scheduled") patch.scheduledDate = date ?? todayISO();
  if (status === "Paid") patch.paidAt = date ?? todayISO();
  if (status === "Approved") {
    patch.scheduledDate = null;
    patch.paidAt = null;
    patch.status = statusAfterReview(inv);
  }
  await repo.updateInvoice(id, patch);
  refresh(id);
  return { ok: true };
}

export async function retryExtraction(id: string): Promise<ActionResult> {
  const { repo, inv } = await loadInvoice(id);
  if (inv.confirmedAt) return { ok: false, error: "This invoice is already confirmed." };
  await runExtraction(repo, inv);
  refresh(id);
  const after = await repo.getInvoice(id);
  return after?.extractionError ? { ok: false, error: after.extractionError } : { ok: true, message: "Read again." };
}

export async function deleteInvoice(id: string) {
  const { repo, inv } = await loadInvoice(id);
  if (inv.confirmedAt) throw new Error("Confirmed invoices can't be deleted. Mark it Disputed instead.");
  await repo.deleteInvoice(id);
  refresh(id);
  redirect("/inbox");
}
