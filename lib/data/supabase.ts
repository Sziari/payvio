import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  Member,
  RecurringCost,
  Vendor,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const map = {
  company: (r: Row): Company => ({
    id: r.id, name: r.name, address: r.address, city: r.city, state: r.state, phone: r.phone,
    inboundSlug: r.inbound_slug, startingCashCents: num(r.starting_cash_cents), minCashCents: num(r.min_cash_cents),
    qboExpenseAccounts: r.qbo_expense_accounts ?? {},
  }),
  job: (r: Row): Job => ({
    id: r.id, name: r.name, jobNumber: r.job_number, address: r.address, city: r.city, customer: r.customer,
    contractCents: num(r.contract_cents), budgets: r.budgets ?? {}, archived: r.archived, createdAt: r.created_at,
  }),
  vendor: (r: Row): Vendor => ({ id: r.id, name: r.name, qboVendorId: r.qbo_vendor_id }),
  invoice: (r: Row): Invoice => ({
    id: r.id, vendorId: r.vendor_id, vendorName: r.vendor_name, invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date, dueDate: r.due_date, shipTo: r.ship_to, jobId: r.job_id,
    suggestedJobId: r.suggested_job_id, costType: r.cost_type, lineItems: r.line_items ?? [],
    subtotalCents: num(r.subtotal_cents), taxCents: num(r.tax_cents), totalCents: num(r.total_cents),
    isCreditMemo: r.is_credit_memo, isFinanceCharge: r.is_finance_charge,
    discountPercent: numOrNull(r.discount_percent), discountDueDate: r.discount_due_date,
    status: r.status, approvals: r.approvals ?? [], fileName: r.file_name, fileMime: r.file_mime, filePath: r.file_path,
    source: r.source, extractionError: r.extraction_error, confirmedAt: r.confirmed_at,
    scheduledDate: r.scheduled_date, paidAt: r.paid_at, qboBillId: r.qbo_bill_id, createdAt: r.created_at,
  }),
  payment: (r: Row): ExpectedPayment => ({
    id: r.id, jobId: r.job_id, customer: r.customer, amountCents: num(r.amount_cents),
    expectedDate: r.expected_date, received: r.received, note: r.note,
  }),
  recurring: (r: Row): RecurringCost => ({
    id: r.id, name: r.name, category: r.category, amountCents: num(r.amount_cents),
    frequency: r.frequency, nextDate: r.next_date, active: r.active,
  }),
  connection: (r: Row): Connection => ({
    id: r.id, provider: r.provider, externalId: r.external_id, displayName: r.display_name,
    status: r.status, lastSyncedAt: r.last_synced_at, lastError: r.last_error,
  }),
  account: (r: Row): BankAccount => ({
    id: r.id, connectionId: r.connection_id, name: r.name, mask: r.mask, type: r.type, subtype: r.subtype,
    currentCents: numOrNull(r.current_cents), availableCents: numOrNull(r.available_cents),
    includeInCash: r.include_in_cash, updatedAt: r.updated_at,
  }),
  transaction: (r: Row): BankTransaction => ({
    id: r.id, accountId: r.account_id, date: r.date, name: r.name, amountCents: num(r.amount_cents), pending: r.pending,
  }),
};

// camelCase patch -> snake_case columns
const COLUMN: Record<string, string> = {
  name: "name", address: "address", city: "city", state: "state", phone: "phone",
  startingCashCents: "starting_cash_cents", minCashCents: "min_cash_cents", qboExpenseAccounts: "qbo_expense_accounts",
  jobNumber: "job_number", customer: "customer", contractCents: "contract_cents", budgets: "budgets", archived: "archived",
  qboVendorId: "qbo_vendor_id",
  vendorId: "vendor_id", vendorName: "vendor_name", invoiceNumber: "invoice_number", invoiceDate: "invoice_date",
  dueDate: "due_date", shipTo: "ship_to", jobId: "job_id", suggestedJobId: "suggested_job_id", costType: "cost_type",
  lineItems: "line_items", subtotalCents: "subtotal_cents", taxCents: "tax_cents", totalCents: "total_cents",
  isCreditMemo: "is_credit_memo", isFinanceCharge: "is_finance_charge", discountPercent: "discount_percent",
  discountDueDate: "discount_due_date", status: "status", approvals: "approvals", fileName: "file_name",
  fileMime: "file_mime", filePath: "file_path", source: "source", extraction: "extraction",
  extractionError: "extraction_error", confirmedAt: "confirmed_at", confirmedBy: "confirmed_by",
  scheduledDate: "scheduled_date", paidAt: "paid_at", qboBillId: "qbo_bill_id",
  amountCents: "amount_cents", expectedDate: "expected_date", received: "received", note: "note",
  category: "category", frequency: "frequency", nextDate: "next_date", active: "active",
};

export function toColumns(patch: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const col = COLUMN[k];
    if (!col) throw new Error(`Unknown field ${k}`);
    out[col] = v;
  }
  return out;
}

// Throws on a database error. Lists are never null without an error; maybeSingle() can be null.
function check(res: { data: unknown; error: { message: string } | null }): any {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export class SupabaseRepo implements Repo {
  readonly mode = "live" as const;
  constructor(private db: SupabaseClient, readonly companyId: string) {}

  private from(table: string) {
    return this.db.from(table);
  }

  async getCompany() {
    return map.company(check(await this.from("companies").select("*").eq("id", this.companyId).single()));
  }
  async updateCompany(patch: CompanyPatch) {
    check(await this.from("companies").update(toColumns(patch)).eq("id", this.companyId));
  }
  async listMembers(): Promise<Member[]> {
    const rows = check(await this.from("company_members").select("*").eq("company_id", this.companyId));
    return rows.map((r: Row) => ({ userId: r.user_id, email: r.email, role: r.role }));
  }

  async listJobs() {
    const rows = check(await this.from("jobs").select("*").eq("company_id", this.companyId).order("created_at"));
    return rows.map(map.job);
  }
  async getJob(id: string) {
    const r = check(await this.from("jobs").select("*").eq("company_id", this.companyId).eq("id", id).maybeSingle());
    return r ? map.job(r) : null;
  }
  async createJob(input: NewJob) {
    const r = check(
      await this.from("jobs").insert({ ...toColumns(input), company_id: this.companyId }).select("*").single(),
    );
    return map.job(r);
  }
  async updateJob(id: string, patch: Partial<NewJob>) {
    check(await this.from("jobs").update(toColumns(patch)).eq("company_id", this.companyId).eq("id", id));
  }

  async listVendors() {
    const rows = check(await this.from("vendors").select("*").eq("company_id", this.companyId).order("name"));
    return rows.map(map.vendor);
  }
  async ensureVendor(name: string) {
    const clean = name.trim();
    const pattern = clean.replace(/[%_\\]/g, "\\$&"); // exact, case-insensitive match
    const existing = check(await this.from("vendors").select("*").eq("company_id", this.companyId).ilike("name", pattern));
    if (existing.length) return map.vendor(existing[0]);
    const res = await this.from("vendors").insert({ company_id: this.companyId, name: clean }).select("*").single();
    if (res.error) {
      // Another request created it at the same moment
      const again = check(await this.from("vendors").select("*").eq("company_id", this.companyId).ilike("name", pattern));
      if (again.length) return map.vendor(again[0]);
      throw new Error(res.error.message);
    }
    return map.vendor(res.data);
  }
  async updateVendor(id: string, patch: Partial<Omit<Vendor, "id">>) {
    check(await this.from("vendors").update(toColumns(patch)).eq("company_id", this.companyId).eq("id", id));
  }

  async listInvoices() {
    const rows = check(
      await this.from("invoices")
        .select("*")
        .eq("company_id", this.companyId)
        .order("created_at", { ascending: false })
        .limit(5000),
    );
    return rows.map(map.invoice);
  }
  async getInvoice(id: string) {
    const r = check(await this.from("invoices").select("*").eq("company_id", this.companyId).eq("id", id).maybeSingle());
    return r ? map.invoice(r) : null;
  }
  async createInvoice(input: NewInvoice) {
    const r = check(
      await this.from("invoices").insert({ ...toColumns(input), company_id: this.companyId }).select("*").single(),
    );
    return map.invoice(r);
  }
  async updateInvoice(id: string, patch: NewInvoice & { extraction?: unknown }) {
    check(await this.from("invoices").update(toColumns(patch)).eq("company_id", this.companyId).eq("id", id));
  }
  async deleteInvoice(id: string) {
    check(await this.from("invoices").delete().eq("company_id", this.companyId).eq("id", id));
  }

  async uploadFile(fileName: string, mime: string, bytes: Uint8Array) {
    const path = `${this.companyId}/${crypto.randomUUID()}-${fileName.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await this.db.storage.from("invoices").upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(error.message);
    return path;
  }
  async downloadFile(path: string) {
    if (!path.startsWith(this.companyId + "/")) return null;
    const { data, error } = await this.db.storage.from("invoices").download(path);
    if (error || !data) return null;
    return { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type || "application/octet-stream" };
  }

  async listPayments() {
    const rows = check(
      await this.from("expected_payments").select("*").eq("company_id", this.companyId).order("expected_date"),
    );
    return rows.map(map.payment);
  }
  async createPayment(input: NewPayment) {
    check(await this.from("expected_payments").insert({ ...toColumns(input), company_id: this.companyId }));
  }
  async updatePayment(id: string, patch: Partial<NewPayment>) {
    check(await this.from("expected_payments").update(toColumns(patch)).eq("company_id", this.companyId).eq("id", id));
  }
  async deletePayment(id: string) {
    check(await this.from("expected_payments").delete().eq("company_id", this.companyId).eq("id", id));
  }

  async listRecurring() {
    const rows = check(await this.from("recurring_costs").select("*").eq("company_id", this.companyId).order("name"));
    return rows.map(map.recurring);
  }
  async createRecurring(input: NewRecurring) {
    check(await this.from("recurring_costs").insert({ ...toColumns(input), company_id: this.companyId }));
  }
  async updateRecurring(id: string, patch: Partial<NewRecurring>) {
    check(await this.from("recurring_costs").update(toColumns(patch)).eq("company_id", this.companyId).eq("id", id));
  }
  async deleteRecurring(id: string) {
    check(await this.from("recurring_costs").delete().eq("company_id", this.companyId).eq("id", id));
  }

  async getLayout(): Promise<DashboardLayout | null> {
    const r = check(
      await this.from("dashboard_layouts").select("layout").eq("company_id", this.companyId).maybeSingle(),
    );
    return (r?.layout as DashboardLayout) ?? null;
  }
  async saveLayout(layout: DashboardLayout | null) {
    if (layout === null) {
      check(await this.from("dashboard_layouts").delete().eq("company_id", this.companyId));
      return;
    }
    check(
      await this.from("dashboard_layouts").upsert({
        company_id: this.companyId,
        layout,
        updated_at: new Date().toISOString(),
      }),
    );
  }

  async listConnections() {
    const rows = check(await this.from("connections").select("*").eq("company_id", this.companyId).order("created_at"));
    return rows.map(map.connection);
  }
  async listBankAccounts() {
    const rows = check(await this.from("bank_accounts").select("*").eq("company_id", this.companyId).order("name"));
    return rows.map(map.account);
  }
  async setAccountIncluded(id: string, include: boolean) {
    check(
      await this.from("bank_accounts").update({ include_in_cash: include }).eq("company_id", this.companyId).eq("id", id),
    );
  }
  async listBankTransactions(limit = 50) {
    const rows = check(
      await this.from("bank_transactions")
        .select("*")
        .eq("company_id", this.companyId)
        .order("date", { ascending: false })
        .limit(limit),
    );
    return rows.map(map.transaction);
  }
}
