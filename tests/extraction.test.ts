import { describe, expect, it } from "vitest";
import { fieldsFromExtraction } from "@/lib/invoices/process";
import { ExtractedInvoice } from "@/lib/ai/extract-invoice";
import { buildSampleData } from "@/lib/data/sample";

const jobs = buildSampleData("2026-11-25").jobs;

const base: ExtractedInvoice = {
  is_invoice: true,
  vendor_name: "  CalPortland ",
  invoice_number: "88123",
  invoice_date: "2026-04-06",
  due_date: "2026-05-06",
  ship_to: "2700 PLAZA COURT DIXON CA",
  job_reference: null,
  line_items: [
    { description: "Ready-mix 3000 PSI", quantity: 9, unit_price: 168, amount: 1512 },
    { description: "Short load fee", quantity: 1, unit_price: 85, amount: 85 },
  ],
  subtotal: 1597,
  tax: 126.63,
  total: 1723.63,
  is_credit_memo: false,
  is_finance_charge: false,
  early_pay_discount_percent: null,
  discount_due_date: null,
  suggested_cost_type: "Material",
  notes: null,
};

describe("turning the AI's answer into invoice fields", () => {
  it("matches the schema the AI must follow", () => {
    expect(ExtractedInvoice.safeParse(base).success).toBe(true);
  });

  it("converts dollars to cents and suggests the job by address", () => {
    const f = fieldsFromExtraction(base, jobs);
    expect(f.vendorName).toBe("CalPortland");
    expect(f.subtotalCents).toBe(159700);
    expect(f.taxCents).toBe(12663);
    expect(f.totalCents).toBe(172363);
    expect(f.lineItems?.[0].amountCents).toBe(151200);
    expect(f.suggestedJobId).toBe("job-dixon");
    expect(f.jobId).toBe("job-dixon");
  });

  it("makes credit memos negative even if printed as positive", () => {
    const f = fieldsFromExtraction(
      { ...base, is_credit_memo: true, line_items: [{ description: "Return", quantity: 1, unit_price: 50, amount: 50 }], subtotal: 50, tax: 0, total: 50 },
      jobs,
    );
    expect(f.totalCents).toBe(-5000);
    expect(f.lineItems?.[0].amountCents).toBe(-5000);
  });

  it("fills a missing total from subtotal + tax, and missing tax from the difference", () => {
    expect(fieldsFromExtraction({ ...base, total: null }, jobs).totalCents).toBe(172363);
    expect(fieldsFromExtraction({ ...base, tax: null }, jobs).taxCents).toBe(12663);
  });

  it("drops impossible dates and tags finance charges", () => {
    const f = fieldsFromExtraction({ ...base, invoice_date: "2026-02-30", is_finance_charge: true }, jobs);
    expect(f.invoiceDate).toBeNull();
    expect(f.costType).toBe("Finance charge");
  });

  it("uses a printed job number when there is no address", () => {
    const f = fieldsFromExtraction({ ...base, ship_to: null, job_reference: "PO 2403" }, jobs);
    expect(f.suggestedJobId).toBe("job-vacaville");
  });
});
