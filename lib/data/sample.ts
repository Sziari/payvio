import { addDays, todayISO, weekStart } from "@/lib/dates";
import type { Company, ExpectedPayment, Invoice, Job, RecurringCost } from "@/lib/types";

// Sample data with known answers so the math can be checked by hand.
// Known answer: the Dixon job (2700 Plaza Ct) totals $2,145.60, all in April 2026.

export type SampleData = {
  company: Omit<Company, "id" | "inboundSlug">;
  jobs: Job[];
  invoices: Invoice[];
  payments: ExpectedPayment[];
  recurring: RecurringCost[];
};

const blankInvoice: Omit<Invoice, "id" | "createdAt"> = {
  vendorId: null,
  vendorName: null,
  invoiceNumber: null,
  invoiceDate: null,
  dueDate: null,
  shipTo: null,
  jobId: null,
  suggestedJobId: null,
  costType: null,
  lineItems: [],
  subtotalCents: 0,
  taxCents: 0,
  totalCents: 0,
  isCreditMemo: false,
  isFinanceCharge: false,
  discountPercent: null,
  discountDueDate: null,
  status: "Approved",
  approvals: [],
  fileName: null,
  fileMime: null,
  filePath: null,
  source: "upload",
  extractionError: null,
  confirmedAt: null,
  scheduledDate: null,
  paidAt: null,
  qboBillId: null,
};

/** Builds sample data. `id` makes ids unique per company (live mode inserts new uuids anyway). */
export function buildSampleData(today = todayISO()): SampleData {
  const t = (days: number) => addDays(today, days);
  const created = new Date().toISOString();
  const confirmed = created;

  const jobs: Job[] = [
    {
      id: "job-dixon", name: "Dixon Warehouse Slab", jobNumber: "2401", address: "2700 Plaza Ct", city: "Dixon",
      customer: "Westbrook Builders", contractCents: 18_500_000, archived: false, createdAt: created,
      budgets: { Material: 6_000_000, Trucking: 800_000, "Equipment rental": 600_000, Labor: 7_000_000 },
    },
    {
      id: "job-tiburon", name: "Tiburon Residence", jobNumber: "2402", address: "114 Lyford Dr", city: "Tiburon",
      customer: "Bayview Custom Homes", contractCents: 9_200_000, archived: false, createdAt: created,
      budgets: { Material: 2_800_000, Trucking: 300_000, "Equipment rental": 250_000, Labor: 3_800_000 },
    },
    {
      id: "job-vacaville", name: "Vacaville Medical Office", jobNumber: "2403", address: "455 Nut Tree Rd", city: "Vacaville",
      customer: "Summit General Contractors", contractCents: 24_000_000, archived: false, createdAt: created,
      budgets: { Material: 8_000_000, Trucking: 1_000_000, "Equipment rental": 900_000, Labor: 9_500_000, Subcontract: 1_500_000 },
    },
    {
      id: "job-fairfield", name: "Fairfield School Walkways", jobNumber: "2404", address: "1200 Travis Blvd", city: "Fairfield",
      customer: "Tri-Valley Construction", contractCents: 13_000_000, archived: false, createdAt: created,
      budgets: { Material: 4_200_000, Trucking: 500_000, "Equipment rental": 400_000, Labor: 5_200_000 },
    },
    {
      id: "job-napa", name: "Napa Winery Pad", jobNumber: "2405", address: "3500 Silverado Trail", city: "Napa",
      customer: "Vintner Group", contractCents: 7_500_000, archived: false, createdAt: created,
      budgets: { Material: 2_400_000, Trucking: 300_000, Labor: 2_900_000 },
    },
  ];

  const inv = (p: Partial<Invoice> & { id: string }): Invoice => ({ ...blankInvoice, createdAt: created, ...p });

  const invoices: Invoice[] = [
    // --- Dixon, April 2026: totals $2,145.60 ---
    inv({
      id: "inv-calportland-88123", vendorName: "CalPortland", invoiceNumber: "88123",
      invoiceDate: "2026-04-06", dueDate: "2026-05-06", shipTo: "2700 Plaza Ct, Dixon CA",
      jobId: "job-dixon", costType: "Material", status: "Paid", paidAt: "2026-05-04", confirmedAt: confirmed,
      lineItems: [
        { description: "Ready-mix 3000 PSI", quantity: 9, unitPriceCents: 16_800, amountCents: 151_200 },
        { description: "Short load fee", quantity: 1, unitPriceCents: 8_500, amountCents: 8_500 },
      ],
      subtotalCents: 159_700, taxCents: 12_663, totalCents: 172_363,
      approvals: [{ role: "office_manager", userId: "sample", at: confirmed }],
    }),
    inv({
      id: "inv-delta-t5512", vendorName: "Delta Rock & Haul", invoiceNumber: "T-5512",
      invoiceDate: "2026-04-14", dueDate: "2026-05-14", shipTo: "2700 Plaza Court, Dixon",
      jobId: "job-dixon", costType: "Trucking", status: "Paid", paidAt: "2026-05-12", confirmedAt: confirmed,
      lineItems: [{ description: "10-wheeler, hourly", quantity: 3, unitPriceCents: 12_000, amountCents: 36_000 }],
      subtotalCents: 36_000, taxCents: 0, totalCents: 36_000,
    }),
    inv({
      id: "inv-whitecap-50001", vendorName: "White Cap", invoiceNumber: "50001",
      invoiceDate: "2026-04-20", dueDate: "2026-05-20", shipTo: "Job 2401 - Dixon",
      jobId: "job-dixon", costType: "Material", status: "Paid", paidAt: "2026-05-18", confirmedAt: confirmed,
      lineItems: [
        { description: "Rebar chairs, bag", quantity: 2, unitPriceCents: 2_495, amountCents: 4_990 },
        { description: "Tie wire", quantity: 1, unitPriceCents: 729, amountCents: 729 },
      ],
      subtotalCents: 5_719, taxCents: 478, totalCents: 6_197,
    }),

    // --- Open payables on other jobs (dated relative to today) ---
    inv({
      id: "inv-calportland-90410", vendorName: "CalPortland", invoiceNumber: "90410",
      invoiceDate: t(-20), dueDate: t(10), shipTo: "455 Nut Tree Rd, Vacaville",
      jobId: "job-vacaville", costType: "Material", status: "Approved", confirmedAt: confirmed,
      lineItems: [{ description: "Ready-mix 4000 PSI", quantity: 60, unitPriceCents: 17_900, amountCents: 1_074_000 }],
      subtotalCents: 1_074_000, taxCents: 89_948, totalCents: 1_163_948,
      discountPercent: 2, discountDueDate: t(2),
      approvals: [
        { role: "office_manager", userId: "sample", at: confirmed },
        { role: "owner", userId: "sample", at: confirmed },
      ],
    }),
    inv({
      id: "inv-sunbelt-7781", vendorName: "Sunbelt Rentals", invoiceNumber: "7781-02",
      invoiceDate: t(-12), dueDate: t(18), shipTo: "455 Nut Tree Road, Vacaville CA",
      jobId: "job-vacaville", costType: "Equipment rental", status: "Scheduled", scheduledDate: t(16), confirmedAt: confirmed,
      lineItems: [{ description: "Power trowel 46in, weekly", quantity: 2, unitPriceCents: 42_500, amountCents: 85_000 }],
      subtotalCents: 85_000, taxCents: 7_119, totalCents: 92_119,
      approvals: [{ role: "office_manager", userId: "sample", at: confirmed }],
    }),
    inv({
      id: "inv-delta-t5790", vendorName: "Delta Rock & Haul", invoiceNumber: "T-5790",
      invoiceDate: t(-8), dueDate: t(22), shipTo: "1200 Travis Blvd, Fairfield",
      jobId: "job-fairfield", costType: "Trucking", status: "Approved", confirmedAt: confirmed,
      lineItems: [{ description: "Base rock delivery", quantity: 6, unitPriceCents: 9_500, amountCents: 57_000 }],
      subtotalCents: 57_000, taxCents: 0, totalCents: 57_000,
      approvals: [{ role: "office_manager", userId: "sample", at: confirmed }],
    }),
    inv({
      id: "inv-whitecap-fc", vendorName: "White Cap", invoiceNumber: "FC-0326",
      invoiceDate: t(-5), dueDate: t(5), shipTo: null,
      jobId: "job-tiburon", costType: "Finance charge", isFinanceCharge: true, status: "Approved", confirmedAt: confirmed,
      lineItems: [{ description: "Late payment finance charge 1.5%", quantity: null, unitPriceCents: null, amountCents: 4_215 }],
      subtotalCents: 4_215, taxCents: 0, totalCents: 4_215,
    }),
    inv({
      id: "inv-whitecap-cm", vendorName: "White Cap", invoiceNumber: "CM-1187",
      invoiceDate: t(-4), dueDate: t(-4), shipTo: "114 Lyford Dr, Tiburon",
      jobId: "job-tiburon", costType: "Material", isCreditMemo: true, status: "Approved", confirmedAt: confirmed,
      lineItems: [{ description: "Returned form stakes", quantity: 40, unitPriceCents: -310, amountCents: -12_400 }],
      subtotalCents: -12_400, taxCents: -1_038, totalCents: -13_438,
    }),
    inv({
      id: "inv-calportland-89977", vendorName: "CalPortland", invoiceNumber: "89977",
      invoiceDate: t(-35), dueDate: t(-5), shipTo: "114 Lyford Drive, Tiburon",
      jobId: "job-tiburon", costType: "Material", status: "Approved", confirmedAt: confirmed,
      lineItems: [{ description: "Ready-mix 3000 PSI, pump mix", quantity: 22, unitPriceCents: 18_400, amountCents: 404_800 }],
      subtotalCents: 404_800, taxCents: 37_444, totalCents: 442_244,
      approvals: [{ role: "office_manager", userId: "sample", at: confirmed }],
    }),
    inv({
      id: "inv-napa-materials", vendorName: "Napa Valley Building Supply", invoiceNumber: "NV-2231",
      invoiceDate: t(-60), dueDate: t(-30), shipTo: "3500 Silverado Trail, Napa",
      jobId: "job-napa", costType: "Material", status: "Paid", paidAt: t(-29), confirmedAt: confirmed,
      lineItems: [{ description: "Rebar #4, 20ft", quantity: 300, unitPriceCents: 1_150, amountCents: 345_000 }],
      subtotalCents: 345_000, taxCents: 26_738, totalCents: 371_738,
      approvals: [{ role: "office_manager", userId: "sample", at: confirmed }],
    }),

    // --- Waiting in the AP inbox for a human to check ---
    inv({
      id: "inv-inbox-1", vendorName: "CalPortland", invoiceNumber: "90577",
      invoiceDate: t(-2), dueDate: t(28), shipTo: "1200 Travis Blvd, Fairfield CA",
      suggestedJobId: "job-fairfield", costType: "Material", status: "Needs review",
      lineItems: [{ description: "Ready-mix 3000 PSI", quantity: 18, unitPriceCents: 16_900, amountCents: 304_200 }],
      subtotalCents: 304_200, taxCents: 23_576, totalCents: 327_776,
    }),
    inv({
      id: "inv-inbox-2", vendorName: "Sunbelt Rentals", invoiceNumber: "7802-01",
      invoiceDate: t(-1), dueDate: t(29), shipTo: "Job #2405 Silverado Trail",
      suggestedJobId: "job-napa", costType: "Equipment rental", status: "Needs review",
      lineItems: [{ description: "Laser screed, daily", quantity: 1, unitPriceCents: 38_000, amountCents: 38_000 }],
      subtotalCents: 38_000, taxCents: 3_183, totalCents: 41_183,
    }),
  ];

  const payments: ExpectedPayment[] = [
    { id: "pay-1", jobId: "job-dixon", customer: "Westbrook Builders", amountCents: 4_500_000, expectedDate: t(10), received: false, note: "Progress billing #3" },
    { id: "pay-2", jobId: "job-tiburon", customer: "Bayview Custom Homes", amountCents: 2_200_000, expectedDate: t(-12), received: false, note: "Pay app #2 - overdue" },
    { id: "pay-3", jobId: "job-vacaville", customer: "Summit General Contractors", amountCents: 6_000_000, expectedDate: t(35), received: false, note: "Progress billing #1" },
    { id: "pay-4", jobId: "job-fairfield", customer: "Tri-Valley Construction", amountCents: 3_000_000, expectedDate: t(56), received: false, note: null },
    { id: "pay-5", jobId: "job-napa", customer: "Vintner Group", amountCents: 750_000, expectedDate: t(77), received: false, note: "Retention release" },
    { id: "pay-6", jobId: "job-dixon", customer: "Westbrook Builders", amountCents: 4_000_000, expectedDate: t(40), received: false, note: "Progress billing #4" },
    { id: "pay-7", jobId: "job-vacaville", customer: "Summit General Contractors", amountCents: 5_500_000, expectedDate: t(66), received: false, note: "Progress billing #2" },
  ];

  const friday = addDays(weekStart(today), 4);
  const recurring: RecurringCost[] = [
    { id: "rc-payroll", name: "Weekly payroll", category: "payroll", amountCents: 1_850_000, frequency: "weekly", nextDate: friday >= today ? friday : addDays(friday, 7), active: true },
    { id: "rc-loan", name: "Equipment loan", category: "loan", amountCents: 240_000, frequency: "monthly", nextDate: t(9), active: true },
    { id: "rc-lease", name: "Truck lease", category: "lease", amountCents: 185_000, frequency: "monthly", nextDate: t(15), active: true },
    { id: "rc-card", name: "Company credit card", category: "card", amountCents: 600_000, frequency: "monthly", nextDate: t(20), active: true },
    { id: "rc-rent", name: "Yard rent", category: "lease", amountCents: 320_000, frequency: "monthly", nextDate: t(3), active: true },
  ];

  return {
    company: {
      name: "Advance Concrete",
      address: "820 Industrial Way",
      city: "Dixon",
      state: "CA",
      phone: null,
      startingCashCents: 6_400_000,
      minCashCents: 2_500_000,
      qboExpenseAccounts: {},
    },
    jobs,
    invoices,
    payments,
    recurring,
  };
}
