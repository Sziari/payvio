import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, Pencil } from "lucide-react";
import { costTypes } from "@/config/workflows";
import { requireContext } from "@/lib/data/context";
import { costByAllMonths, costByVendor, isCosted, jobCostSummary } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th, buttonVariants } from "@/components/ui";
import { StatusBadge } from "@/components/ui/status-badge";
import { BudgetBar } from "@/components/budget-bar";
import { MonthlyBarChart } from "@/components/charts";
import { ArchiveButton } from "./archive-button";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { repo } = await requireContext();
  const [job, invoices] = await Promise.all([repo.getJob(id), repo.listInvoices()]);
  if (!job) notFound();

  const summary = jobCostSummary(job, invoices);
  const jobInvoices = invoices
    .filter((i) => i.jobId === job.id)
    .sort((a, b) => (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? ""));
  const vendors = costByVendor(invoices, job.id);
  const months = costByAllMonths(invoices, job.id);
  const remaining = job.contractCents - summary.totalCents;

  const tiles = [
    { label: "Contract", value: formatMoney(job.contractCents) },
    { label: "Cost to date", value: formatMoney(summary.totalCents) },
    { label: "Budget", value: summary.budgetCents ? formatMoney(summary.budgetCents) : "Not set" },
    { label: "Contract left after costs", value: formatMoney(remaining), danger: remaining < 0 },
  ];

  return (
    <>
      <PageHeader
        title={job.name}
        description={[job.jobNumber && `Job #${job.jobNumber}`, job.customer, job.address, job.city]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <a href={`/api/jobs/${job.id}/export?format=csv`} className={buttonVariants({ variant: "outline" })}>
              <Download /> CSV
            </a>
            <a href={`/api/jobs/${job.id}/export?format=xlsx`} className={buttonVariants({ variant: "outline" })}>
              <Download /> Excel
            </a>
            <Link href={`/jobs/${job.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil /> Edit
            </Link>
            <ArchiveButton id={job.id} archived={job.archived} />
          </>
        }
      />
      {job.archived && <Badge className="mb-4">Archived</Badge>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className={`tabular mt-1 text-xl font-semibold sm:text-2xl ${t.danger ? "text-danger" : ""}`}>{t.value}</p>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Cost by type vs budget" />
          <Table>
            <thead>
              <tr>
                <Th>Cost type</Th>
                <Th className="text-right">Spent</Th>
                <Th className="min-w-40">Budget</Th>
              </tr>
            </thead>
            <tbody>
              {costTypes
                .filter((t) => summary.byType[t] !== 0 || job.budgets[t])
                .map((t) => (
                  <tr key={t}>
                    <Td>
                      {t}
                      {t === "Finance charge" && summary.byType[t] > 0 && (
                        <Badge tone="danger" className="ml-2">
                          Late fees
                        </Badge>
                      )}
                    </Td>
                    <Td className="tabular text-right">{formatMoney(summary.byType[t])}</Td>
                    <Td>
                      <BudgetBar spent={summary.byType[t]} budget={job.budgets[t] ?? 0} />
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
          {(summary.financeChargeCents !== 0 || summary.creditCents !== 0) && (
            <div className="flex flex-wrap gap-2 p-4 text-sm">
              {summary.financeChargeCents !== 0 && (
                <Badge tone="danger">Finance charges: {formatMoney(summary.financeChargeCents)}</Badge>
              )}
              {summary.creditCents !== 0 && <Badge tone="success">Credits: {formatMoney(summary.creditCents)}</Badge>}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Cost by supplier" />
          {vendors.length === 0 ? (
            <EmptyState title="No costs yet" />
          ) : (
            <Table>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.vendor}>
                    <Td>{v.vendor}</Td>
                    <Td className="tabular text-right">{formatMoney(v.cents)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Cost by month" />
        <div className="p-4">
          {months.length === 0 ? <EmptyState title="No costs yet" /> : <MonthlyBarChart data={months} />}
        </div>
      </Card>

      <Card>
        <CardHeader title="Invoices" description="Every invoice tagged to this job, with its original file." />
        {jobInvoices.length === 0 ? (
          <EmptyState title="No invoices yet">Upload invoices in the AP Inbox and pick this job.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Supplier</Th>
                <Th>Invoice #</Th>
                <Th className="hidden sm:table-cell">Cost type</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
                <Th>File</Th>
              </tr>
            </thead>
            <tbody>
              {jobInvoices.map((inv) => (
                <tr key={inv.id} className={isCosted(inv) ? "" : "text-muted"}>
                  <Td className="whitespace-nowrap">{formatDate(inv.invoiceDate)}</Td>
                  <Td>
                    <Link href={`/inbox/${inv.id}`} className="hover:underline">
                      {inv.vendorName ?? "Unknown"}
                    </Link>
                    {inv.isFinanceCharge && (
                      <Badge tone="danger" className="ml-2">
                        Finance charge
                      </Badge>
                    )}
                    {inv.isCreditMemo && (
                      <Badge tone="success" className="ml-2">
                        Credit
                      </Badge>
                    )}
                  </Td>
                  <Td>{inv.invoiceNumber ?? "-"}</Td>
                  <Td className="hidden sm:table-cell">{inv.costType ?? "-"}</Td>
                  <Td>
                    <StatusBadge status={inv.status} />
                  </Td>
                  <Td className="tabular text-right">{formatMoney(inv.totalCents)}</Td>
                  <Td>
                    {inv.filePath ? (
                      <a href={`/api/invoices/${inv.id}/file`} target="_blank" className="inline-flex items-center gap-1 hover:underline">
                        <FileText className="size-4" /> View
                      </a>
                    ) : (
                      <span className="text-xs text-muted">Sample</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
