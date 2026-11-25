import type { Role } from "@/config/workflows";
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

export type NewJob = Omit<Job, "id" | "createdAt" | "archived"> & { archived?: boolean };
export type NewInvoice = Partial<Omit<Invoice, "id" | "createdAt">>;
export type NewPayment = Omit<ExpectedPayment, "id">;
export type NewRecurring = Omit<RecurringCost, "id">;
export type CompanyPatch = Partial<Omit<Company, "id" | "inboundSlug">>;

/**
 * Everything the app reads or writes for the signed-in user's company.
 * Two implementations: demo (in memory) and Supabase (Row Level Security).
 */
export interface Repo {
  readonly mode: "demo" | "live";
  readonly companyId: string;

  getCompany(): Promise<Company>;
  updateCompany(patch: CompanyPatch): Promise<void>;
  listMembers(): Promise<Member[]>;

  listJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | null>;
  createJob(input: NewJob): Promise<Job>;
  updateJob(id: string, patch: Partial<NewJob>): Promise<void>;

  listVendors(): Promise<Vendor[]>;
  /** Find a vendor by name (case-insensitive) or create it. */
  ensureVendor(name: string): Promise<Vendor>;
  updateVendor(id: string, patch: Partial<Omit<Vendor, "id">>): Promise<void>;

  listInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | null>;
  createInvoice(input: NewInvoice): Promise<Invoice>;
  updateInvoice(id: string, patch: NewInvoice & { extraction?: unknown }): Promise<void>;
  deleteInvoice(id: string): Promise<void>;

  /** Stores an original invoice file and returns its storage path. */
  uploadFile(fileName: string, mime: string, bytes: Uint8Array): Promise<string>;
  downloadFile(path: string): Promise<{ bytes: Uint8Array; mime: string } | null>;

  listPayments(): Promise<ExpectedPayment[]>;
  createPayment(input: NewPayment): Promise<void>;
  updatePayment(id: string, patch: Partial<NewPayment>): Promise<void>;
  deletePayment(id: string): Promise<void>;

  listRecurring(): Promise<RecurringCost[]>;
  createRecurring(input: NewRecurring): Promise<void>;
  updateRecurring(id: string, patch: Partial<NewRecurring>): Promise<void>;
  deleteRecurring(id: string): Promise<void>;

  getLayout(): Promise<DashboardLayout | null>;
  saveLayout(layout: DashboardLayout | null): Promise<void>;

  listConnections(): Promise<Connection[]>;
  listBankAccounts(): Promise<BankAccount[]>;
  setAccountIncluded(id: string, include: boolean): Promise<void>;
  listBankTransactions(limit?: number): Promise<BankTransaction[]>;
}

export type SessionUser = { id: string; email: string | null; role: Role };
