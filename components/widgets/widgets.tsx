"use client";

import Link from "next/link";
import { formatDate, formatShortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Badge, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/ui/status-badge";
import { BudgetBar } from "@/components/budget-bar";
import { CashLineChart, MonthlyBarChart } from "@/components/charts";
import { cn } from "@/lib/utils";
import type { WidgetProps } from "./types";

// Each widget is self-contained: it gets the dashboard data and its own props from the layout.
// Visual design is intentionally plain so it can be restyled later.

const METRICS = {
  cashOnHand: {
    value: (d: WidgetProps["data"]) => formatMoney(d.kpis.cashOnHand),
    sub: (d: WidgetProps["data"]) => (d.kpis.cashSource === "bank" ? "From your bank" : "Entered by hand"),
    href: "/forecast",
  },
  weeksOfPayroll: {
    value: (d: WidgetProps["data"]) => (d.kpis.weeksOfPayroll === null ? "-" : `${d.kpis.weeksOfPayroll} weeks`),
    sub: () => "Cash on hand ÷ weekly payroll",
    href: "/forecast",
    danger: (d: WidgetProps["data"]) => d.kpis.weeksOfPayroll !== null && d.kpis.weeksOfPayroll < 2,
  },
  apDue14: {
    value: (d: WidgetProps["data"]) => formatMoney(d.kpis.apDue14),
    sub: () => "Approved supplier bills due soon",
    href: "/inbox?tab=open",
  },
  arOverdue: {
    value: (d: WidgetProps["data"]) => formatMoney(d.kpis.arOverdue),
    sub: () => "Customer payments past their date",
    href: "/forecast",
    danger: (d: WidgetProps["data"]) => d.kpis.arOverdue > 0,
  },
} as const;
export type MetricKey = keyof typeof METRICS;
export const METRIC_LABELS: Record<MetricKey, string> = {
  cashOnHand: "Cash on hand",
  weeksOfPayroll: "Weeks of payroll",
  apDue14: "AP due in 14 days",
  arOverdue: "Overdue from customers",
};

export function KpiCard({ data, title, props }: WidgetProps) {
  const m = METRICS[(props?.metric as MetricKey) ?? "cashOnHand"] ?? METRICS.cashOnHand;
  const danger = "danger" in m && m.danger(data);
  return (
    <Link href={m.href} className="flex h-full flex-col justify-center p-4 hover:bg-surface-2">
      <p className="text-xs font-medium text-muted">{title}</p>
      <p className={cn("tabular mt-1 text-2xl font-semibold", danger && "text-danger")}>{m.value(data)}</p>
      <p className="mt-0.5 text-xs text-muted">{m.sub(data)}</p>
    </Link>
  );
}

export function CashForecast({ data }: WidgetProps) {
  const low = data.forecast.find((w) => w.belowMin);
  return (
    <div className="flex h-full flex-col p-3">
      {low && (
        <p className="mb-2 text-xs text-danger">
          Below your minimum in the week of {formatShortDate(low.start)} ({formatMoney(low.endingCents)})
        </p>
      )}
      <div className="min-h-0 flex-1">
        <CashLineChart data={data.forecast} minCents={data.minCashCents} height="100%" />
      </div>
    </div>
  );
}

export function InboxQueue({ data }: WidgetProps) {
  if (data.inbox.length === 0) return <EmptyState title="All caught up">No invoices waiting.</EmptyState>;
  return (
    <div className="flex h-full flex-col">
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-auto">
        {data.inbox.map((i) => (
          <li key={i.id}>
            <Link href={`/inbox/${i.id}`} className="flex items-center justify-between gap-2 px-4 py-2 text-sm hover:bg-surface-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{i.vendor}</span>
                <span className="flex gap-1">
                  <StatusBadge status={i.status} />
                  {i.flag && <Badge tone="danger">{i.flag}</Badge>}
                </span>
              </span>
              <span className="tabular shrink-0">{formatMoney(i.totalCents)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/inbox" className="border-t border-border px-4 py-2 text-center text-sm font-medium hover:bg-surface-2">
        Review {data.inboxCount} invoice{data.inboxCount === 1 ? "" : "s"}
      </Link>
    </div>
  );
}

export function JobCostTable({ data }: WidgetProps) {
  if (data.jobCosts.length === 0) return <EmptyState title="No active jobs" />;
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="text-left text-xs text-muted">
            <th className="px-4 py-2 font-medium">Job</th>
            <th className="px-4 py-2 text-right font-medium">Cost to date</th>
            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Contract</th>
            <th className="min-w-40 px-4 py-2 font-medium">Budget used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.jobCosts.map((j) => (
            <tr key={j.id}>
              <td className="px-4 py-2">
                <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">{j.name}</Link>
              </td>
              <td className="tabular px-4 py-2 text-right">{formatMoney(j.totalCents)}</td>
              <td className="tabular hidden px-4 py-2 text-right sm:table-cell">{formatMoney(j.contractCents)}</td>
              <td className="px-4 py-2"><BudgetBar spent={j.totalCents} budget={j.budgetCents} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VendorBalances({ data }: WidgetProps) {
  if (data.vendorBalances.length === 0) return <EmptyState title="You don't owe any suppliers" />;
  return (
    <ul className="h-full divide-y divide-border overflow-auto text-sm">
      {data.vendorBalances.map((v) => (
        <li key={v.vendor} className="flex items-center justify-between gap-2 px-4 py-2">
          <span className="min-w-0">
            <span className="block truncate font-medium">{v.vendor}</span>
            <span className="text-xs text-muted">
              {v.count} open · oldest due {formatDate(v.oldestDue)}
            </span>
          </span>
          <span className="tabular shrink-0">{formatMoney(v.cents)}</span>
        </li>
      ))}
    </ul>
  );
}

export function MaterialByMonth({ data }: WidgetProps) {
  return (
    <div className="h-full p-3">
      <MonthlyBarChart data={data.materialByMonth} height="100%" />
    </div>
  );
}
