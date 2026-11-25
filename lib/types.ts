import type { CostType, InvoiceStatus, Role } from "@/config/workflows";
import type { WidgetPlacement } from "@/config/dashboard";

export type Company = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  inboundSlug: string;
  startingCashCents: number; // manual cash on hand until a bank is connected
  minCashCents: number; // forecast warning threshold
  qboExpenseAccounts: Record<string, string>; // cost type -> QuickBooks account id ("default" key = fallback)
};

export type Member = { userId: string; email: string | null; role: Role };

export type Job = {
  id: string;
  name: string;
  jobNumber: string | null;
  address: string | null;
  city: string | null;
  customer: string | null;
  contractCents: number;
  budgets: Partial<Record<CostType, number>>; // cents
  archived: boolean;
  createdAt: string;
};

export type Vendor = { id: string; name: string; qboVendorId: string | null };

export type LineItem = {
  description: string;
  quantity: number | null;
  unitPriceCents: number | null;
  amountCents: number;
  costType?: CostType | null;
};

export type Approval = { role: Role; userId: string; at: string };

export type Invoice = {
  id: string;
  vendorId: string | null;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null; // YYYY-MM-DD
  dueDate: string | null;
  shipTo: string | null;
  jobId: string | null;
  suggestedJobId: string | null;
  costType: CostType | null;
  lineItems: LineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  isCreditMemo: boolean;
  isFinanceCharge: boolean;
  discountPercent: number | null;
  discountDueDate: string | null;
  status: InvoiceStatus;
  approvals: Approval[];
  fileName: string | null;
  fileMime: string | null;
  filePath: string | null;
  source: "upload" | "email";
  extractionError: string | null;
  confirmedAt: string | null;
  scheduledDate: string | null;
  paidAt: string | null;
  qboBillId: string | null;
  createdAt: string;
};

export type ExpectedPayment = {
  id: string;
  jobId: string | null;
  customer: string;
  amountCents: number;
  expectedDate: string;
  received: boolean;
  note: string | null;
};

export type RecurringCost = {
  id: string;
  name: string;
  category: "payroll" | "loan" | "lease" | "card" | "other";
  amountCents: number;
  frequency: "weekly" | "biweekly" | "monthly";
  nextDate: string;
  active: boolean;
};

export type BankAccount = {
  id: string;
  connectionId: string;
  name: string;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  currentCents: number | null;
  availableCents: number | null;
  includeInCash: boolean;
  updatedAt: string;
};

export type BankTransaction = {
  id: string;
  accountId: string;
  date: string;
  name: string;
  amountCents: number; // positive = money out (Plaid convention)
  pending: boolean;
};

export type Connection = {
  id: string;
  provider: "plaid" | "quickbooks";
  externalId: string;
  displayName: string | null;
  status: "active" | "needs_reauth" | "error";
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type DashboardLayout = WidgetPlacement[];
