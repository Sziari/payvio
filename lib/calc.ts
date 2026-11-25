import { costTypes, type CostType } from "@/config/workflows";
import { addDays, addMonths, monthKey, todayISO } from "@/lib/dates";
import type { BankAccount, Company, ExpectedPayment, Invoice, Job, RecurringCost } from "@/lib/types";

/** Invoices that count toward job cost: a human confirmed them and they are not disputed. */
export function isCosted(inv: Invoice): boolean {
  return !!inv.confirmedAt && inv.status !== "Disputed";
}

/** Invoices we still owe: confirmed, not paid, not disputed. */
export function isOpenPayable(inv: Invoice): boolean {
  return !!inv.confirmedAt && inv.status !== "Paid" && inv.status !== "Disputed";
}

/**
 * Split one invoice's total across cost types.
 * Each line uses its own cost type (or the invoice's); tax, freight and anything
 * not on a line goes to the invoice's cost type.
 */
export function invoiceCostSplit(inv: Invoice): Map<CostType, number> {
  const out = new Map<CostType, number>();
  const base: CostType = inv.isFinanceCharge ? "Finance charge" : (inv.costType ?? "Other");
  const add = (t: CostType, c: number) => out.set(t, (out.get(t) ?? 0) + c);
  let lineSum = 0;
  for (const line of inv.lineItems) {
    add(line.costType ?? base, line.amountCents);
    lineSum += line.amountCents;
  }
  const rest = inv.totalCents - lineSum;
  if (rest !== 0 || inv.lineItems.length === 0) add(base, rest);
  return out;
}

export type JobCostSummary = {
  job: Job;
  byType: Record<CostType, number>;
  totalCents: number;
  budgetCents: number;
  financeChargeCents: number;
  creditCents: number;
};

export function emptyByType(): Record<CostType, number> {
  return Object.fromEntries(costTypes.map((t) => [t, 0])) as Record<CostType, number>;
}

export function jobCostSummary(job: Job, invoices: Invoice[]): JobCostSummary {
  const byType = emptyByType();
  let financeChargeCents = 0;
  let creditCents = 0;
  for (const inv of invoices) {
    if (inv.jobId !== job.id || !isCosted(inv)) continue;
    for (const [t, c] of invoiceCostSplit(inv)) byType[t] += c;
    if (inv.isFinanceCharge) financeChargeCents += inv.totalCents;
    if (inv.isCreditMemo || inv.totalCents < 0) creditCents += inv.totalCents;
  }
  const totalCents = Object.values(byType).reduce((a, b) => a + b, 0);
  const budgetCents = Object.values(job.budgets).reduce((a, b) => a + (b ?? 0), 0);
  return { job, byType, totalCents, budgetCents, financeChargeCents, creditCents };
}

export function costByVendor(invoices: Invoice[], jobId?: string) {
  const map = new Map<string, number>();
  for (const inv of invoices) {
    if (!isCosted(inv) || (jobId && inv.jobId !== jobId)) continue;
    const key = inv.vendorName ?? "Unknown supplier";
    map.set(key, (map.get(key) ?? 0) + inv.totalCents);
  }
  return [...map.entries()].map(([vendor, cents]) => ({ vendor, cents })).sort((a, b) => b.cents - a.cents);
}

/** Cost per month (YYYY-MM), optionally only one job or one cost type. */
export function costByMonth(
  invoices: Invoice[],
  opts: { jobId?: string; costType?: CostType; months?: number; today?: string } = {},
) {
  const today = opts.today ?? todayISO();
  const months = opts.months ?? 6;
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) keys.push(monthKey(addMonths(today.slice(0, 8) + "01", -i)));
  const map = new Map(keys.map((k) => [k, 0]));
  for (const inv of invoices) {
    if (!isCosted(inv) || !inv.invoiceDate || (opts.jobId && inv.jobId !== opts.jobId)) continue;
    const k = monthKey(inv.invoiceDate);
    if (!map.has(k)) continue;
    const cents = opts.costType ? (invoiceCostSplit(inv).get(opts.costType) ?? 0) : inv.totalCents;
    map.set(k, map.get(k)! + cents);
  }
  return keys.map((month) => ({ month, cents: map.get(month)! }));
}

/** Costs across all invoice months (for job detail charts) */
export function costByAllMonths(invoices: Invoice[], jobId: string) {
  const map = new Map<string, number>();
  for (const inv of invoices) {
    if (!isCosted(inv) || inv.jobId !== jobId || !inv.invoiceDate) continue;
    const k = monthKey(inv.invoiceDate);
    map.set(k, (map.get(k) ?? 0) + inv.totalCents);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, cents]) => ({ month, cents }));
}

export function vendorBalances(invoices: Invoice[]) {
  const map = new Map<string, { vendor: string; cents: number; count: number; oldestDue: string | null }>();
  for (const inv of invoices) {
    if (!isOpenPayable(inv)) continue;
    const vendor = inv.vendorName ?? "Unknown supplier";
    const row = map.get(vendor) ?? { vendor, cents: 0, count: 0, oldestDue: null };
    row.cents += inv.totalCents;
    row.count += 1;
    if (inv.dueDate && (!row.oldestDue || inv.dueDate < row.oldestDue)) row.oldestDue = inv.dueDate;
    map.set(vendor, row);
  }
  return [...map.values()].sort((a, b) => b.cents - a.cents);
}

export function cashOnHandCents(company: Company, accounts: BankAccount[]): { cents: number; source: "bank" | "manual" } {
  const included = accounts.filter((a) => a.includeInCash && a.currentCents !== null);
  if (included.length > 0) {
    return { cents: included.reduce((s, a) => s + (a.availableCents ?? a.currentCents ?? 0), 0), source: "bank" };
  }
  return { cents: company.startingCashCents, source: "manual" };
}

export function weeklyPayrollCents(costs: RecurringCost[]): number {
  return costs
    .filter((c) => c.active && c.category === "payroll")
    .reduce((s, c) => {
      if (c.frequency === "weekly") return s + c.amountCents;
      if (c.frequency === "biweekly") return s + c.amountCents / 2;
      return s + (c.amountCents * 12) / 52;
    }, 0);
}

export type Kpis = {
  cashOnHand: number;
  cashSource: "bank" | "manual";
  weeksOfPayroll: number | null;
  apDue14: number;
  arOverdue: number;
};

export function computeKpis(input: {
  company: Company;
  accounts: BankAccount[];
  invoices: Invoice[];
  payments: ExpectedPayment[];
  recurring: RecurringCost[];
  today?: string;
}): Kpis {
  const today = input.today ?? todayISO();
  const cash = cashOnHandCents(input.company, input.accounts);
  const weekly = weeklyPayrollCents(input.recurring);
  const in14 = addDays(today, 14);
  return {
    cashOnHand: cash.cents,
    cashSource: cash.source,
    weeksOfPayroll: weekly > 0 ? Math.round((cash.cents / weekly) * 10) / 10 : null,
    apDue14: input.invoices
      .filter((i) => isOpenPayable(i) && (i.dueDate ?? i.invoiceDate ?? today) <= in14)
      .reduce((s, i) => s + i.totalCents, 0),
    arOverdue: input.payments
      .filter((p) => !p.received && p.expectedDate < today)
      .reduce((s, p) => s + p.amountCents, 0),
  };
}

/** Early-pay discounts expiring soon (config: earlyPayDiscountAlertDays) */
export function expiringDiscounts(invoices: Invoice[], withinDays: number, today = todayISO()) {
  const limit = addDays(today, withinDays);
  return invoices.filter(
    (i) => isOpenPayable(i) && i.discountPercent && i.discountDueDate && i.discountDueDate >= today && i.discountDueDate <= limit,
  );
}
