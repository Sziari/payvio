"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate, todayISO } from "@/lib/dates";
import { centsToInput, formatMoney } from "@/lib/money";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Notice, Select, Table, Td, Th } from "@/components/ui";
import type { Company, ExpectedPayment, Job, RecurringCost } from "@/lib/types";
import {
  deletePayment,
  deleteRecurring,
  saveCashSettings,
  savePayment,
  saveRecurring,
  setPaymentReceived,
  type Result,
} from "./actions";

export function ForecastInputs({
  company,
  cashSource,
  payments,
  recurring,
  jobs,
}: {
  company: Company;
  cashSource: "bank" | "manual";
  payments: ExpectedPayment[];
  recurring: RecurringCost[];
  jobs: Job[];
}) {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <div className="xl:col-span-2">
        <CashSettings company={company} cashSource={cashSource} />
      </div>
      <Payments payments={payments} jobs={jobs} />
      <Recurring recurring={recurring} />
    </div>
  );
}

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) after?.();
    });
  return { pending, result, run, setResult };
}

function CashSettings({ company, cashSource }: { company: Company; cashSource: "bank" | "manual" }) {
  const { pending, result, run } = useAction();
  return (
    <Card>
      <CardHeader
        title="Starting point"
        description={
          cashSource === "bank"
            ? "Cash today comes from your connected bank accounts."
            : "Type today's bank balance. Connect your bank in Settings to fill this in automatically."
        }
      />
      <form action={(fd) => run(() => saveCashSettings(fd))} className="grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Cash today ($)" hint={cashSource === "bank" ? "Used only if the bank is disconnected." : undefined}>
          <Input name="startingCash" inputMode="decimal" defaultValue={centsToInput(company.startingCashCents)} />
        </Field>
        <Field label="Warn me below ($)">
          <Input name="minCash" inputMode="decimal" defaultValue={centsToInput(company.minCashCents)} />
        </Field>
        <div className="flex items-end">
          <Button variant="outline" disabled={pending}>
            Save
          </Button>
        </div>
        {result && !result.ok && <Notice tone="danger" className="sm:col-span-3">{result.error}</Notice>}
      </form>
    </Card>
  );
}

function Payments({ payments, jobs }: { payments: ExpectedPayment[]; jobs: Job[] }) {
  const [editing, setEditing] = useState<ExpectedPayment | "new" | null>(null);
  const { pending, result, run, setResult } = useAction();
  const [, startToggle] = useTransition();
  const jobName = new Map(jobs.map((j) => [j.id, j.name]));
  const today = todayISO();
  const open = payments.filter((p) => !p.received);
  const received = payments.filter((p) => p.received);

  return (
    <Card>
      <CardHeader
        title="Expected customer payments"
        description="What GCs and customers owe you, and when you expect it."
        action={
          <Button size="sm" variant="outline" onClick={() => { setResult(null); setEditing("new"); }}>
            <Plus /> Add
          </Button>
        }
      />
      {editing && (
        <form
          key={editing === "new" ? "new" : editing.id}
          action={(fd) => run(() => savePayment(fd), () => setEditing(null))}
          className="grid gap-3 border-b border-border bg-surface-2 p-4 sm:grid-cols-2"
        >
          {editing !== "new" && <input type="hidden" name="id" value={editing.id} />}
          <Field label="Customer / GC">
            <Input name="customer" defaultValue={editing === "new" ? "" : editing.customer} required />
          </Field>
          <Field label="Job">
            <Select name="jobId" defaultValue={editing === "new" ? "" : (editing.jobId ?? "")}>
              <option value="">No specific job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Amount ($)">
            <Input name="amount" inputMode="decimal" defaultValue={editing === "new" ? "" : centsToInput(editing.amountCents)} required />
          </Field>
          <Field label="Expected date">
            <Input name="expectedDate" type="date" defaultValue={editing === "new" ? today : editing.expectedDate} required />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <Input name="note" placeholder="Pay app #3" defaultValue={editing === "new" ? "" : (editing.note ?? "")} />
          </Field>
          {result && !result.ok && <Notice tone="danger" className="sm:col-span-2">{result.error}</Notice>}
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={pending}>Save</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}
      {open.length === 0 && !editing ? (
        <EmptyState title="No expected payments">Add what customers owe you so the forecast knows when cash comes in.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Expected</Th>
              <Th className="text-right">Amount</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {open.map((p) => (
              <tr key={p.id}>
                <Td>
                  <p className="font-medium">{p.customer}</p>
                  <p className="text-xs text-muted">{[p.jobId && jobName.get(p.jobId), p.note].filter(Boolean).join(" · ")}</p>
                </Td>
                <Td className="whitespace-nowrap">
                  {formatDate(p.expectedDate)}
                  {p.expectedDate < today && <Badge tone="danger" className="ml-2">Overdue</Badge>}
                </Td>
                <Td className="tabular text-right">{formatMoney(p.amountCents)}</Td>
                <Td className="whitespace-nowrap text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Mark received"
                    title="Mark received"
                    onClick={() => startToggle(() => setPaymentReceived(p.id, true))}
                  >
                    <CheckCircle2 />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { setResult(null); setEditing(p); }}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete"
                    onClick={() => confirm("Delete this expected payment?") && startToggle(() => deletePayment(p.id))}
                  >
                    <Trash2 />
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {received.length > 0 && (
        <details className="border-t border-border px-4 py-3 text-sm">
          <summary className="cursor-pointer text-muted">Received ({received.length})</summary>
          <ul className="mt-2 space-y-1">
            {received.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{p.customer} · {formatMoney(p.amountCents)}</span>
                <button className="text-xs underline" onClick={() => startToggle(() => setPaymentReceived(p.id, false))}>
                  Not received
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

const CATEGORY_LABEL: Record<RecurringCost["category"], string> = {
  payroll: "Payroll",
  loan: "Loan",
  lease: "Lease / rent",
  card: "Credit card",
  other: "Other",
};

function Recurring({ recurring }: { recurring: RecurringCost[] }) {
  const [editing, setEditing] = useState<RecurringCost | "new" | null>(null);
  const { pending, result, run, setResult } = useAction();
  const [, startDelete] = useTransition();
  return (
    <Card>
      <CardHeader
        title="Recurring costs"
        description="Payroll, loans, leases and card payments that repeat."
        action={
          <Button size="sm" variant="outline" onClick={() => { setResult(null); setEditing("new"); }}>
            <Plus /> Add
          </Button>
        }
      />
      {editing && (
        <form
          key={editing === "new" ? "new" : editing.id}
          action={(fd) => run(() => saveRecurring(fd), () => setEditing(null))}
          className="grid gap-3 border-b border-border bg-surface-2 p-4 sm:grid-cols-2"
        >
          {editing !== "new" && <input type="hidden" name="id" value={editing.id} />}
          <Field label="Name">
            <Input name="name" placeholder="Weekly payroll" defaultValue={editing === "new" ? "" : editing.name} required />
          </Field>
          <Field label="Type">
            <Select name="category" defaultValue={editing === "new" ? "payroll" : editing.category}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Amount each time ($)">
            <Input name="amount" inputMode="decimal" defaultValue={editing === "new" ? "" : centsToInput(editing.amountCents)} required />
          </Field>
          <Field label="How often">
            <Select name="frequency" defaultValue={editing === "new" ? "weekly" : editing.frequency}>
              <option value="weekly">Every week</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Every month</option>
            </Select>
          </Field>
          <Field label="Next payment date">
            <Input name="nextDate" type="date" defaultValue={editing === "new" ? todayISO() : editing.nextDate} required />
          </Field>
          {result && !result.ok && <Notice tone="danger" className="sm:col-span-2">{result.error}</Notice>}
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={pending}>Save</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}
      {recurring.length === 0 && !editing ? (
        <EmptyState title="No recurring costs">Add payroll first. It&apos;s usually the biggest one.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Cost</Th>
              <Th>How often</Th>
              <Th className="text-right">Amount</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {recurring.map((r) => (
              <tr key={r.id}>
                <Td>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted">{CATEGORY_LABEL[r.category]} · next {formatDate(r.nextDate)}</p>
                </Td>
                <Td className="capitalize">{r.frequency === "biweekly" ? "Every 2 weeks" : r.frequency}</Td>
                <Td className="tabular text-right">{formatMoney(r.amountCents)}</Td>
                <Td className="whitespace-nowrap text-right">
                  <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { setResult(null); setEditing(r); }}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete"
                    onClick={() => confirm(`Delete ${r.name}?`) && startDelete(() => deleteRecurring(r.id))}
                  >
                    <Trash2 />
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
