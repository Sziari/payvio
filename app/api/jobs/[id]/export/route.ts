import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { loadContext } from "@/lib/data/context";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Stop spreadsheet formula injection from text that came off an invoice
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadContext();
  if (!ctx.repo) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const job = await ctx.repo.getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const invoices = (await ctx.repo.listInvoices())
    .filter((i) => i.jobId === job.id)
    .sort((a, b) => (a.invoiceDate ?? "").localeCompare(b.invoiceDate ?? ""));

  const header = [
    "Invoice date", "Supplier", "Invoice #", "Cost type", "Status", "Due date",
    "Subtotal", "Tax", "Total", "Finance charge", "Credit memo", "Ship to",
  ];
  const rows = invoices.map((i) => [
    i.invoiceDate, i.vendorName, i.invoiceNumber, i.costType, i.status, i.dueDate,
    i.subtotalCents / 100, i.taxCents / 100, i.totalCents / 100,
    i.isFinanceCharge ? "Yes" : "", i.isCreditMemo ? "Yes" : "", i.shipTo,
  ]);
  const safeName = job.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "job";

  if (request.nextUrl.searchParams.get("format") === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Invoices");
    ws.addRow(header).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.addRow([]);
    ws.addRow(["", "", "", "", "", "", "", "Total", invoices.reduce((s, i) => s + i.totalCents, 0) / 100]).font = { bold: true };
    [7, 8, 9].forEach((c) => (ws.getColumn(c).numFmt = '"$"#,##0.00'));
    ws.columns.forEach((col) => (col.width = 16));
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}-invoices.xlsx"`,
      },
    });
  }

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-invoices.csv"`,
    },
  });
}
