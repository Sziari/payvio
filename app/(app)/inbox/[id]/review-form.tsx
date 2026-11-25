"use client";

import { useState, useTransition } from "react";
import { Check, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { costTypes, invoiceWorkflow, type CostType } from "@/config/workflows";
import { Badge, Button, Card, CardHeader, Field, Input, Notice, Select } from "@/components/ui";
import { formatDate, todayISO } from "@/lib/dates";
import { centsToInput, formatMoney, toCents } from "@/lib/money";
import type { Invoice, Job } from "@/lib/types";
import {
  approveInvoice,
  confirmInvoice,
  deleteInvoice,
  retryExtraction,
  saveInvoice,
  setInvoiceStatus,
  type ActionResult,
  type InvoiceFormData,
} from "../actions";

function initialForm(inv: Invoice): InvoiceFormData {
  return {
    vendorName: inv.vendorName ?? "",
    invoiceNumber: inv.invoiceNumber ?? "",
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    shipTo: inv.shipTo ?? "",
    // Pre-select the suggested job until a person has confirmed
    jobId: inv.jobId ?? (inv.confirmedAt ? null : inv.suggestedJobId),
    costType: inv.costType,
    subtotal: centsToInput(inv.subtotalCents),
    tax: centsToInput(inv.taxCents),
    total: centsToInput(inv.totalCents),
    isCreditMemo: inv.isCreditMemo,
    isFinanceCharge: inv.isFinanceCharge,
    discountPercent: inv.discountPercent?.toString() ?? "",
    discountDueDate: inv.discountDueDate,
    lineItems: inv.lineItems.map((l) => ({
      description: l.description,
      quantity: l.quantity?.toString() ?? "",
      unitPrice: centsToInput(l.unitPriceCents),
      amount: centsToInput(l.amountCents),
      costType: l.costType ?? null,
    })),
  };
}

export function ReviewForm({
  invoice,
  jobs,
  canApprove,
  pendingRoles,
}: {
  invoice: Invoice;
  jobs: Job[];
  canApprove: boolean;
  pendingRoles: string[];
}) {
  const [f, setF] = useState<InvoiceFormData>(() => initialForm(invoice));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [payDate, setPayDate] = useState(invoice.scheduledDate ?? invoice.dueDate ?? todayISO());
  const confirmed = !!invoice.confirmedAt;
  const set = <K extends keyof InvoiceFormData>(k: K, v: InvoiceFormData[K]) => setF((p) => ({ ...p, [k]: v }));
  const run = (fn: () => Promise<ActionResult | void>) =>
    start(async () => {
      try {
        const r = await fn();
        if (r) setResult(r);
      } catch (e) {
        setResult({ ok: false, error: e instanceof Error ? e.message : "Something went wrong." });
      }
    });

  // Math checks, shown as gentle warnings
  const lineSum = f.lineItems.reduce((s, l) => s + (toCents(l.amount) ?? 0), 0);
  const subtotal = toCents(f.subtotal) ?? 0;
  const tax = toCents(f.tax) ?? 0;
  const total = toCents(f.total) ?? 0;
  const warnings: string[] = [];
  if (f.lineItems.length > 0 && lineSum !== subtotal) warnings.push(`Lines add up to ${formatMoney(lineSum)}, but the subtotal is ${formatMoney(subtotal)}.`);
  if (subtotal + tax !== total) warnings.push(`Subtotal + tax is ${formatMoney(subtotal + tax)}, but the total is ${formatMoney(total)}.`);
  if (f.isCreditMemo && total > 0) warnings.push("Credit memos are usually negative amounts.");

  const suggested = invoice.suggestedJobId ? jobs.find((j) => j.id === invoice.suggestedJobId) : null;
  const updateLine = (i: number, patch: Partial<InvoiceFormData["lineItems"][number]>) =>
    set("lineItems", f.lineItems.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={confirmed ? "Invoice details" : "Check these details"}
          description={
            confirmed
              ? `Confirmed ${formatDate(invoice.confirmedAt!.slice(0, 10))}`
              : "Compare with the document. Fix anything that's wrong, then press Confirm."
          }
          action={
            !confirmed && invoice.filePath ? (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(async () => {
                const r = await retryExtraction(invoice.id);
                if (r.ok) window.location.reload();
                return r;
              })}>
                <RefreshCw /> Read again
              </Button>
            ) : null
          }
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Supplier">
            <Input value={f.vendorName} onChange={(e) => set("vendorName", e.target.value)} />
          </Field>
          <Field label="Invoice #">
            <Input value={f.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} />
          </Field>
          <Field label="Invoice date">
            <Input type="date" value={f.invoiceDate ?? ""} onChange={(e) => set("invoiceDate", e.target.value || null)} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={f.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value || null)} />
          </Field>
          <Field label="Ship to / job reference (from the invoice)" className="sm:col-span-2">
            <Input value={f.shipTo} onChange={(e) => set("shipTo", e.target.value)} />
          </Field>
          <Field
            label="Job"
            hint={
              suggested ? (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-3" /> Suggested from the invoice: {suggested.name}
                </span>
              ) : (
                "No match found from the address. Pick the job."
              )
            }
          >
            <Select value={f.jobId ?? ""} onChange={(e) => set("jobId", e.target.value || null)}>
              <option value="">Pick a job...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                  {j.jobNumber ? ` (#${j.jobNumber})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cost type">
            <Select value={f.costType ?? ""} onChange={(e) => set("costType", (e.target.value || null) as CostType | null)}>
              <option value="">Pick...</option>
              {costTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.isCreditMemo} onChange={(e) => set("isCreditMemo", e.target.checked)} />
              Credit memo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.isFinanceCharge} onChange={(e) => set("isFinanceCharge", e.target.checked)} />
              Finance / late charge
            </label>
            {f.isFinanceCharge && invoiceWorkflow.flagFinanceCharges && <Badge tone="danger">Late fees are tracked separately</Badge>}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Line items"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                set("lineItems", [...f.lineItems, { description: "", quantity: "", unitPrice: "", amount: "", costType: null }])
              }
            >
              <Plus /> Add line
            </Button>
          }
        />
        <div className="divide-y divide-border">
          {f.lineItems.length === 0 && <p className="p-4 text-sm text-muted">No line items. That&apos;s OK; the total is what counts.</p>}
          {f.lineItems.map((l, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 p-3">
              <Input
                className="col-span-6 sm:col-span-3"
                placeholder="Description"
                value={l.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
              />
              <Input
                className="col-span-2 sm:col-span-1"
                placeholder="Qty"
                inputMode="decimal"
                value={l.quantity}
                onChange={(e) => updateLine(i, { quantity: e.target.value })}
              />
              <Input
                className="col-span-2 sm:col-span-1"
                placeholder="Price"
                inputMode="decimal"
                value={l.unitPrice}
                onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
              />
              <Input
                className="col-span-2 sm:col-span-1"
                placeholder="Amount"
                inputMode="decimal"
                value={l.amount}
                onChange={(e) => updateLine(i, { amount: e.target.value })}
              />
              <Select
                className="col-span-5 h-9 text-xs sm:col-span-5"
                value={l.costType ?? ""}
                onChange={(e) => updateLine(i, { costType: (e.target.value || null) as CostType | null })}
              >
                <option value="">Same cost type as invoice</option>
                {costTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="col-span-1 justify-self-end"
                aria-label="Remove line"
                onClick={() => set("lineItems", f.lineItems.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-border p-4">
          <Field label="Subtotal">
            <Input inputMode="decimal" value={f.subtotal} onChange={(e) => set("subtotal", e.target.value)} />
          </Field>
          <Field label="Tax">
            <Input inputMode="decimal" value={f.tax} onChange={(e) => set("tax", e.target.value)} />
          </Field>
          <Field label="Total">
            <Input inputMode="decimal" className="font-semibold" value={f.total} onChange={(e) => set("total", e.target.value)} />
          </Field>
          <Field label="Early-pay discount %">
            <Input inputMode="decimal" value={f.discountPercent} onChange={(e) => set("discountPercent", e.target.value)} />
          </Field>
          <Field label="Discount ends" className="col-span-2">
            <Input type="date" value={f.discountDueDate ?? ""} onChange={(e) => set("discountDueDate", e.target.value || null)} />
          </Field>
        </div>
        {warnings.length > 0 && (
          <Notice className="mx-4 mb-4" title="Numbers don't add up">
            <ul className="list-disc pl-5">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Notice>
        )}
      </Card>

      {result && (
        <Notice tone={result.ok ? "success" : "danger"}>{result.ok ? (result.message ?? "Done.") : result.error}</Notice>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {!confirmed && (
            <Button size="lg" variant="success" disabled={pending} onClick={() => run(() => confirmInvoice(invoice.id, f))}>
              <Check /> Confirm
            </Button>
          )}
          <Button size="lg" variant="outline" disabled={pending} onClick={() => run(() => saveInvoice(invoice.id, f))}>
            Save
          </Button>
          {confirmed && pendingRoles.length > 0 && (
            <Button size="lg" disabled={pending || !canApprove} onClick={() => run(() => approveInvoice(invoice.id))}>
              <Check /> Approve
            </Button>
          )}
          {!confirmed && (
            <Button
              size="lg"
              variant="ghost"
              className="text-danger"
              disabled={pending}
              onClick={() => {
                if (confirm("Delete this invoice? This can't be undone.")) run(() => deleteInvoice(invoice.id));
              }}
            >
              <Trash2 /> Delete
            </Button>
          )}
        </div>
        {confirmed && pendingRoles.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            Waiting for approval from: <span className="capitalize">{pendingRoles.map((r) => r.replace("_", " ")).join(", ")}</span>.
            {!canApprove && " Your role can't approve this step."}
          </p>
        )}

        {confirmed && pendingRoles.length === 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium">Payment</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Date">
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-44" />
              </Field>
              {invoice.status !== "Paid" && (
                <Button variant="outline" disabled={pending} onClick={() => run(() => setInvoiceStatus(invoice.id, "Scheduled", payDate))}>
                  Schedule payment
                </Button>
              )}
              {invoice.status !== "Paid" && (
                <Button variant="success" disabled={pending} onClick={() => run(() => setInvoiceStatus(invoice.id, "Paid", payDate))}>
                  Mark paid
                </Button>
              )}
              {invoice.status !== "Disputed" && invoice.status !== "Paid" && (
                <Button variant="ghost" className="text-danger" disabled={pending} onClick={() => run(() => setInvoiceStatus(invoice.id, "Disputed"))}>
                  Dispute
                </Button>
              )}
              {(invoice.status === "Paid" || invoice.status === "Disputed" || invoice.status === "Scheduled") && (
                <Button variant="ghost" disabled={pending} onClick={() => run(() => setInvoiceStatus(invoice.id, "Approved"))}>
                  Reopen
                </Button>
              )}
            </div>
            {invoice.status === "Scheduled" && invoice.scheduledDate && (
              <p className="mt-2 text-sm text-muted">Scheduled for {formatDate(invoice.scheduledDate)}.</p>
            )}
            {invoice.status === "Paid" && invoice.paidAt && <p className="mt-2 text-sm text-muted">Paid {formatDate(invoice.paidAt)}.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
