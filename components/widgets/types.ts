import type { Kpis } from "@/lib/calc";
import type { ForecastWeek } from "@/lib/forecast";
import type { InvoiceStatus } from "@/config/workflows";

/** Everything widgets can show. Built once on the server per page load (app/(app)/dashboard/page.tsx). */
export type DashboardData = {
  kpis: Kpis;
  minCashCents: number;
  forecast: Pick<ForecastWeek, "start" | "endingCents" | "belowMin" | "inflowCents" | "outflowCents">[];
  inbox: { id: string; vendor: string; totalCents: number; status: InvoiceStatus; flag: string | null }[];
  inboxCount: number;
  jobCosts: { id: string; name: string; totalCents: number; budgetCents: number; contractCents: number }[];
  vendorBalances: { vendor: string; cents: number; count: number; oldestDue: string | null }[];
  materialByMonth: { month: string; cents: number }[];
};

export type WidgetProps = {
  data: DashboardData;
  title: string;
  props?: Record<string, unknown>;
};
