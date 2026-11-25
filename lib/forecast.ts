import { addDays, addMonths, weekStart } from "@/lib/dates";
import { isOpenPayable } from "@/lib/calc";
import type { ExpectedPayment, Invoice, RecurringCost } from "@/lib/types";

export type ForecastItem = {
  kind: "payment" | "recurring" | "invoice";
  id: string; // source row id (recurring items repeat the cost id)
  label: string;
  date: string;
  amountCents: number; // positive = money in, negative = money out
};

export type ForecastWeek = {
  index: number;
  start: string;
  end: string;
  inflowCents: number;
  outflowCents: number; // negative number
  netCents: number;
  endingCents: number;
  belowMin: boolean;
  items: ForecastItem[];
};

export type ForecastInput = {
  today: string;
  startingCashCents: number;
  minCashCents: number;
  payments: ExpectedPayment[];
  recurring: RecurringCost[];
  invoices: Invoice[];
  weeks?: number;
  /** What-if: move an expected payment to another week (payment id -> week index) */
  moves?: Record<string, number>;
};

/** Date we expect to pay a supplier invoice. */
export function invoicePayDate(inv: Invoice, today: string): string {
  return inv.scheduledDate ?? inv.dueDate ?? (inv.invoiceDate ? addDays(inv.invoiceDate, 30) : today);
}

function nextOccurrence(date: string, freq: RecurringCost["frequency"]): string {
  if (freq === "weekly") return addDays(date, 7);
  if (freq === "biweekly") return addDays(date, 14);
  return addMonths(date, 1);
}

export function buildForecast(input: ForecastInput): ForecastWeek[] {
  const count = input.weeks ?? 13;
  const first = weekStart(input.today);
  const horizonEnd = addDays(first, count * 7 - 1);
  const weeks: ForecastWeek[] = Array.from({ length: count }, (_, i) => ({
    index: i,
    start: addDays(first, i * 7),
    end: addDays(first, i * 7 + 6),
    inflowCents: 0,
    outflowCents: 0,
    netCents: 0,
    endingCents: 0,
    belowMin: false,
    items: [],
  }));

  // Anything already overdue lands in week 1 (index 0).
  const weekIndex = (date: string) => {
    if (date < first) return 0;
    if (date > horizonEnd) return -1;
    return Math.floor((Date.parse(date) - Date.parse(first)) / (7 * 86_400_000));
  };
  const place = (item: ForecastItem, idx = weekIndex(item.date)) => {
    if (idx < 0 || idx >= count) return;
    weeks[idx].items.push(item);
  };

  for (const p of input.payments) {
    if (p.received) continue;
    const moved = input.moves?.[p.id];
    const item: ForecastItem = { kind: "payment", id: p.id, label: p.customer, date: p.expectedDate, amountCents: p.amountCents };
    place(item, moved ?? weekIndex(p.expectedDate));
  }

  for (const c of input.recurring) {
    if (!c.active) continue;
    let d = c.nextDate;
    let guard = 0;
    while (d < first && guard++ < 500) d = nextOccurrence(d, c.frequency);
    while (d <= horizonEnd && guard++ < 1000) {
      place({ kind: "recurring", id: c.id, label: c.name, date: d, amountCents: -c.amountCents });
      d = nextOccurrence(d, c.frequency);
    }
  }

  for (const inv of input.invoices) {
    if (!isOpenPayable(inv)) continue;
    place({
      kind: "invoice",
      id: inv.id,
      label: `${inv.vendorName ?? "Supplier"}${inv.invoiceNumber ? ` #${inv.invoiceNumber}` : ""}`,
      date: invoicePayDate(inv, input.today),
      amountCents: -inv.totalCents,
    });
  }

  let running = input.startingCashCents;
  for (const w of weeks) {
    w.items.sort((a, b) => a.date.localeCompare(b.date));
    for (const it of w.items) {
      if (it.amountCents >= 0) w.inflowCents += it.amountCents;
      else w.outflowCents += it.amountCents;
    }
    w.netCents = w.inflowCents + w.outflowCents;
    running += w.netCents;
    w.endingCents = running;
    w.belowMin = running < input.minCashCents;
  }
  return weeks;
}
