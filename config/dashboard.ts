export type WidgetPlacement = {
  id: string;
  widget: string; // a key in components/widgets/registry.tsx
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  props?: Record<string, unknown>;
};

// 12-column grid. x/y = position, w/h = width/height.
// This is the default; each company can drag and resize in "Edit layout" mode.
export const defaultDashboard: WidgetPlacement[] = [
  { id: "cash-on-hand",    widget: "KpiCard",         title: "Cash on hand",           x: 0, y: 0,  w: 3,  h: 2, props: { metric: "cashOnHand" } },
  { id: "weeks-payroll",   widget: "KpiCard",         title: "Weeks of payroll",       x: 3, y: 0,  w: 3,  h: 2, props: { metric: "weeksOfPayroll" } },
  { id: "ap-due",          widget: "KpiCard",         title: "AP due in 14 days",      x: 6, y: 0,  w: 3,  h: 2, props: { metric: "apDue14" } },
  { id: "ar-overdue",      widget: "KpiCard",         title: "Overdue from customers", x: 9, y: 0,  w: 3,  h: 2, props: { metric: "arOverdue" } },
  { id: "forecast",        widget: "CashForecast",    title: "13-week cash forecast",  x: 0, y: 2,  w: 8,  h: 4 },
  { id: "inbox",           widget: "InboxQueue",      title: "Invoices to review",     x: 8, y: 2,  w: 4,  h: 4 },
  { id: "job-cost",        widget: "JobCostTable",    title: "Job cost vs budget",     x: 0, y: 6,  w: 12, h: 4 },
  { id: "vendor-balances", widget: "VendorBalances",  title: "Supplier balances",      x: 0, y: 10, w: 6,  h: 3 },
  { id: "material-month",  widget: "MaterialByMonth", title: "Material by month",      x: 6, y: 10, w: 6,  h: 3 },
];
