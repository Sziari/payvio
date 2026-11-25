import "server-only";
import { buildSampleData } from "@/lib/data/sample";
import type { CompanyPatch, NewInvoice, NewJob, NewPayment, NewRecurring, Repo } from "@/lib/data/repo";
import type {
  BankAccount,
  BankTransaction,
  Company,
  Connection,
  DashboardLayout,
  ExpectedPayment,
  Invoice,
  Job,
  RecurringCost,
  Vendor,
} from "@/lib/types";

// Demo mode keeps everything in server memory. It resets when the server restarts.

export type DemoStore = {
  company: Company;
  jobs: Job[];
  vendors: Vendor[];
  invoices: Invoice[];
  payments: ExpectedPayment[];
  recurring: RecurringCost[];
  layout: DashboardLayout | null;
  connections: Connection[];
  secrets: Map<string, { encrypted: string; cursor: string | null }>;
  accounts: (BankAccount & { plaidAccountId: string })[];
  transactions: (BankTransaction & { plaidTransactionId: string })[];
  files: Map<string, { bytes: Uint8Array; mime: string }>;
};

export const DEMO_COMPANY_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_USER = { id: "00000000-0000-4000-8000-0000000000aa", email: "demo@payvio.app", role: "owner" as const };

const uid = () => crypto.randomUUID();

function createStore(): DemoStore {
  const s = buildSampleData();
  const vendors: Vendor[] = [];
  const invoices = s.invoices.map((inv) => {
    let v = vendors.find((x) => x.name.toLowerCase() === inv.vendorName?.toLowerCase());
    if (!v && inv.vendorName) {
      v = { id: uid(), name: inv.vendorName, qboVendorId: null };
      vendors.push(v);
    }
    return { ...inv, vendorId: v?.id ?? null };
  });
  return {
    company: { ...s.company, id: DEMO_COMPANY_ID, inboundSlug: "advance-concrete" },
    jobs: s.jobs,
    vendors,
    invoices,
    payments: s.payments,
    recurring: s.recurring,
    layout: null,
    connections: [],
    secrets: new Map(),
    accounts: [],
    transactions: [],
    files: new Map(),
  };
}

const g = globalThis as unknown as { __payvioDemo?: DemoStore };
export function demoStore(): DemoStore {
  if (!g.__payvioDemo) g.__payvioDemo = createStore();
  return g.__payvioDemo;
}

const clone = <T>(x: T): T => structuredClone(x);

export class DemoRepo implements Repo {
  readonly mode = "demo" as const;
  readonly companyId = DEMO_COMPANY_ID;
  private get s() {
    return demoStore();
  }

  async getCompany() { return clone(this.s.company); }
  async updateCompany(patch: CompanyPatch) { Object.assign(this.s.company, patch); }
  async listMembers() { return [{ userId: DEMO_USER.id, email: DEMO_USER.email, role: DEMO_USER.role }]; }

  async listJobs() { return clone(this.s.jobs); }
  async getJob(id: string) { return clone(this.s.jobs.find((j) => j.id === id) ?? null); }
  async createJob(input: NewJob) {
    const job: Job = { archived: false, ...input, id: uid(), createdAt: new Date().toISOString() };
    this.s.jobs.push(job);
    return clone(job);
  }
  async updateJob(id: string, patch: Partial<NewJob>) {
    const j = this.s.jobs.find((x) => x.id === id);
    if (j) Object.assign(j, patch);
  }

  async listVendors() { return clone(this.s.vendors).sort((a, b) => a.name.localeCompare(b.name)); }
  async ensureVendor(name: string) {
    const clean = name.trim();
    let v = this.s.vendors.find((x) => x.name.toLowerCase() === clean.toLowerCase());
    if (!v) {
      v = { id: uid(), name: clean, qboVendorId: null };
      this.s.vendors.push(v);
    }
    return clone(v);
  }
  async updateVendor(id: string, patch: Partial<Omit<Vendor, "id">>) {
    const v = this.s.vendors.find((x) => x.id === id);
    if (v) Object.assign(v, patch);
  }

  async listInvoices() {
    return clone(this.s.invoices).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getInvoice(id: string) { return clone(this.s.invoices.find((i) => i.id === id) ?? null); }
  async createInvoice(input: NewInvoice) {
    const inv: Invoice = {
      vendorId: null, vendorName: null, invoiceNumber: null, invoiceDate: null, dueDate: null, shipTo: null,
      jobId: null, suggestedJobId: null, costType: null, lineItems: [], subtotalCents: 0, taxCents: 0, totalCents: 0,
      isCreditMemo: false, isFinanceCharge: false, discountPercent: null, discountDueDate: null, status: "Received",
      approvals: [], fileName: null, fileMime: null, filePath: null, source: "upload", extractionError: null,
      confirmedAt: null, scheduledDate: null, paidAt: null, qboBillId: null,
      ...input,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    this.s.invoices.push(inv);
    return clone(inv);
  }
  async updateInvoice(id: string, patch: NewInvoice & { extraction?: unknown }) {
    const inv = this.s.invoices.find((x) => x.id === id);
    if (!inv) return;
    const { extraction: _ignored, ...rest } = patch;
    void _ignored;
    Object.assign(inv, rest);
  }
  async deleteInvoice(id: string) {
    this.s.invoices = this.s.invoices.filter((i) => i.id !== id);
  }

  async uploadFile(fileName: string, mime: string, bytes: Uint8Array) {
    const path = `${DEMO_COMPANY_ID}/${uid()}-${fileName.replace(/[^\w.\-]+/g, "_")}`;
    this.s.files.set(path, { bytes, mime });
    return path;
  }
  async downloadFile(path: string) { return this.s.files.get(path) ?? null; }

  async listPayments() { return clone(this.s.payments).sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)); }
  async createPayment(input: NewPayment) { this.s.payments.push({ ...input, id: uid() }); }
  async updatePayment(id: string, patch: Partial<NewPayment>) {
    const p = this.s.payments.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  }
  async deletePayment(id: string) { this.s.payments = this.s.payments.filter((p) => p.id !== id); }

  async listRecurring() { return clone(this.s.recurring); }
  async createRecurring(input: NewRecurring) { this.s.recurring.push({ ...input, id: uid() }); }
  async updateRecurring(id: string, patch: Partial<NewRecurring>) {
    const r = this.s.recurring.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
  }
  async deleteRecurring(id: string) { this.s.recurring = this.s.recurring.filter((r) => r.id !== id); }

  async getLayout() { return clone(this.s.layout); }
  async saveLayout(layout: DashboardLayout | null) { this.s.layout = clone(layout); }

  async listConnections() { return clone(this.s.connections); }
  async listBankAccounts() {
    return this.s.accounts.map(({ plaidAccountId: _p, ...a }) => { void _p; return clone(a); });
  }
  async setAccountIncluded(id: string, include: boolean) {
    const a = this.s.accounts.find((x) => x.id === id);
    if (a) a.includeInCash = include;
  }
  async listBankTransactions(limit = 50) {
    return this.s.transactions
      .map(({ plaidTransactionId: _p, ...t }) => { void _p; return clone(t); })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }
}
