import { describe, expect, it } from "vitest";
import { toCents, formatMoney } from "@/lib/money";
import { addMonths, weekStart } from "@/lib/dates";
import { addApproval, checkConfirm, pendingApprovals, requiredApprovals, statusAfterReview } from "@/lib/approvals";
import { suggestJob } from "@/lib/jobmatch";
import { findDuplicate } from "@/lib/duplicates";
import { computeKpis, costByMonth, invoiceCostSplit, jobCostSummary } from "@/lib/calc";
import { buildForecast } from "@/lib/forecast";
import { buildSampleData } from "@/lib/data/sample";

const TODAY = "2026-11-25"; // a Wednesday
const sample = buildSampleData(TODAY);
const company = { ...sample.company, id: "c1", inboundSlug: "advance" };

describe("money", () => {
  it("parses dollars to cents", () => {
    expect(toCents("1,234.56")).toBe(123456);
    expect(toCents("$0.10")).toBe(10);
    expect(toCents("(12.00)")).toBe(-1200);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents("")).toBeNull();
    expect(toCents("abc")).toBeNull();
  });
  it("formats cents", () => {
    expect(formatMoney(214560)).toBe("$2,145.60");
    expect(formatMoney(-1200)).toBe("-$12.00");
  });
});

describe("dates", () => {
  it("finds Monday", () => {
    expect(weekStart("2026-11-25")).toBe("2026-11-23");
    expect(weekStart("2026-11-29")).toBe("2026-11-23"); // Sunday
  });
  it("clamps month ends", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("known answer: Dixon job", () => {
  it("totals $2,145.60, all in April 2026", () => {
    const dixon = sample.jobs.find((j) => j.address === "2700 Plaza Ct")!;
    const s = jobCostSummary(dixon, sample.invoices);
    expect(s.totalCents).toBe(214560);
    expect(s.byType.Material).toBe(172363 + 6197);
    expect(s.byType.Trucking).toBe(36000);
    const months = costByMonth(sample.invoices, { jobId: dixon.id, months: 12, today: "2026-06-15" });
    expect(months.find((m) => m.month === "2026-04")!.cents).toBe(214560);
    expect(months.filter((m) => m.month !== "2026-04").every((m) => m.cents === 0)).toBe(true);
  });
  it("sample invoice lines add up", () => {
    for (const inv of sample.invoices) {
      const lines = inv.lineItems.reduce((s, l) => s + l.amountCents, 0);
      expect(lines, inv.id).toBe(inv.subtotalCents);
      expect(inv.subtotalCents + inv.taxCents, inv.id).toBe(inv.totalCents);
    }
  });
});

describe("cost split", () => {
  it("puts tax with the invoice cost type and respects line cost types", () => {
    const inv = {
      ...sample.invoices[0],
      costType: "Material" as const,
      lineItems: [
        { description: "concrete", quantity: 1, unitPriceCents: 1000, amountCents: 1000 },
        { description: "delivery", quantity: 1, unitPriceCents: 200, amountCents: 200, costType: "Trucking" as const },
      ],
      totalCents: 1300,
    };
    const split = invoiceCostSplit(inv);
    expect(split.get("Material")).toBe(1100);
    expect(split.get("Trucking")).toBe(200);
  });
});

describe("approvals (config/workflows.ts)", () => {
  it("auto-approves small invoices", () => {
    expect(requiredApprovals(49_999)).toEqual([]);
    expect(statusAfterReview({ totalCents: 49_999, approvals: [] })).toBe("Approved");
  });
  it("needs office manager over $500 and owner over $5,000", () => {
    expect(requiredApprovals(60_000).map((s) => s.role)).toEqual(["office_manager"]);
    expect(requiredApprovals(600_000).map((s) => s.role)).toEqual(["office_manager", "owner"]);
  });
  it("signs steps in order and owners can sign any step", () => {
    const inv = { totalCents: 600_000, approvals: [] };
    expect(addApproval(inv, "u", "project_manager")).toBeNull();
    const a1 = addApproval(inv, "u1", "office_manager")!;
    expect(pendingApprovals({ ...inv, approvals: a1 }).map((s) => s.role)).toEqual(["owner"]);
    expect(addApproval({ ...inv, approvals: a1 }, "u1", "office_manager")).toBeNull();
    const a2 = addApproval({ ...inv, approvals: a1 }, "u2", "owner")!;
    expect(statusAfterReview({ ...inv, approvals: a2 })).toBe("Approved");
  });
  it("requires a job before confirming", () => {
    expect(checkConfirm({ jobId: null, vendorName: "X", totalCents: 1 }).ok).toBe(false);
    expect(checkConfirm({ jobId: "j", vendorName: "X", totalCents: 1 }).ok).toBe(true);
  });
});

describe("job matching", () => {
  it("matches by address with abbreviations", () => {
    expect(suggestJob({ shipTo: "2700 PLAZA COURT, DIXON, CA 95620" }, sample.jobs)?.jobId).toBe("job-dixon");
    expect(suggestJob({ shipTo: "114 Lyford Drive Tiburon" }, sample.jobs)?.jobId).toBe("job-tiburon");
  });
  it("matches by job number", () => {
    expect(suggestJob({ shipTo: null, jobReference: "Job #2405" }, sample.jobs)?.jobId).toBe("job-napa");
  });
  it("does not guess on a weak match", () => {
    expect(suggestJob({ shipTo: "2700 Main St, Davis" }, sample.jobs)).toBeNull();
    expect(suggestJob({ shipTo: "Will call" }, sample.jobs)).toBeNull();
  });
});

describe("duplicates", () => {
  it("catches the same supplier + invoice number", () => {
    const dup = findDuplicate(
      { id: "new", vendorId: null, vendorName: "calportland", invoiceNumber: "0088-123" },
      sample.invoices,
    );
    expect(dup?.id).toBe("inv-calportland-88123");
    expect(findDuplicate({ id: "new", vendorId: null, vendorName: "Other Co", invoiceNumber: "88123" }, sample.invoices)).toBeNull();
  });
});

describe("KPIs", () => {
  it("computes from sample data", () => {
    const k = computeKpis({ company, accounts: [], invoices: sample.invoices, payments: sample.payments, recurring: sample.recurring, today: TODAY });
    expect(k.cashOnHand).toBe(6_400_000);
    expect(k.cashSource).toBe("manual");
    expect(k.arOverdue).toBe(2_200_000);
    expect(k.weeksOfPayroll).toBeCloseTo(3.5, 1);
    // open payables due within 14 days: 90410 (t+10), finance charge (t+5), credit memo (t-4), 89977 (t-5)
    expect(k.apDue14).toBe(1_163_948 + 4_215 - 13_438 + 442_244);
  });
});

describe("13-week forecast", () => {
  const base = {
    today: TODAY,
    startingCashCents: sample.company.startingCashCents,
    minCashCents: sample.company.minCashCents,
    payments: sample.payments,
    recurring: sample.recurring,
    invoices: sample.invoices,
  };
  it("has 13 weeks starting Monday and balances", () => {
    const weeks = buildForecast(base);
    expect(weeks).toHaveLength(13);
    expect(weeks[0].start).toBe("2026-11-23");
    const net = weeks.reduce((s, w) => s + w.netCents, 0);
    expect(weeks[12].endingCents).toBe(base.startingCashCents + net);
  });
  it("puts overdue items in week 1 and runs payroll every week", () => {
    const weeks = buildForecast(base);
    expect(weeks[0].items.some((i) => i.id === "pay-2")).toBe(true); // overdue customer payment
    expect(weeks[0].items.some((i) => i.id === "inv-calportland-89977")).toBe(true); // overdue bill
    expect(weeks.every((w) => w.items.some((i) => i.id === "rc-payroll"))).toBe(true);
  });
  it("ignores unconfirmed and paid invoices", () => {
    const ids = buildForecast(base).flatMap((w) => w.items.map((i) => i.id));
    expect(ids).not.toContain("inv-inbox-1");
    expect(ids).not.toContain("inv-calportland-88123");
  });
  it("what-if: moving a payment later lowers earlier balances", () => {
    const normal = buildForecast(base);
    const moved = buildForecast({ ...base, moves: { "pay-1": 8 } });
    expect(moved[1].endingCents).toBe(normal[1].endingCents - 4_500_000);
    expect(moved[12].endingCents).toBe(normal[12].endingCents);
  });
  it("flags weeks below the minimum", () => {
    const weeks = buildForecast({ ...base, startingCashCents: 0 });
    expect(weeks[0].belowMin).toBe(true);
  });
});
