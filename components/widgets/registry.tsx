"use client";

import type { ComponentType } from "react";
import type { WidgetProps } from "./types";
import {
  CashForecast,
  InboxQueue,
  JobCostTable,
  KpiCard,
  MaterialByMonth,
  METRIC_LABELS,
  VendorBalances,
} from "./widgets";

// Every dashboard widget is registered here. config/dashboard.ts places them on the grid.
// To add a widget: build a component that takes WidgetProps, then add an entry below.

export type WidgetDefinition = {
  component: ComponentType<WidgetProps>;
  /** Shown in the "Add widget" library */
  library: { title: string; description: string; props?: Record<string, unknown> }[];
  size: { w: number; h: number; minW?: number; minH?: number };
};

export const widgetRegistry: Record<string, WidgetDefinition> = {
  KpiCard: {
    component: KpiCard,
    library: Object.entries(METRIC_LABELS).map(([metric, title]) => ({
      title,
      description: "A single number",
      props: { metric },
    })),
    size: { w: 3, h: 2, minW: 2, minH: 2 },
  },
  CashForecast: {
    component: CashForecast,
    library: [{ title: "13-week cash forecast", description: "Ending cash each week, with your minimum line" }],
    size: { w: 8, h: 4, minW: 4, minH: 3 },
  },
  InboxQueue: {
    component: InboxQueue,
    library: [{ title: "Invoices to review", description: "Uploads waiting for someone to check" }],
    size: { w: 4, h: 4, minW: 3, minH: 3 },
  },
  JobCostTable: {
    component: JobCostTable,
    library: [{ title: "Job cost vs budget", description: "Every active job with budget used" }],
    size: { w: 12, h: 4, minW: 6, minH: 3 },
  },
  VendorBalances: {
    component: VendorBalances,
    library: [{ title: "Supplier balances", description: "What you owe each supplier" }],
    size: { w: 6, h: 3, minW: 3, minH: 2 },
  },
  MaterialByMonth: {
    component: MaterialByMonth,
    library: [{ title: "Material by month", description: "Material cost for the last 6 months" }],
    size: { w: 6, h: 3, minW: 3, minH: 2 },
  },
};
