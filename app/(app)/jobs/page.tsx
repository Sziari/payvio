import Link from "next/link";
import { Plus } from "lucide-react";
import { requireContext } from "@/lib/data/context";
import { jobCostSummary } from "@/lib/calc";
import { formatMoney } from "@/lib/money";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, buttonVariants } from "@/components/ui";
import { BudgetBar } from "@/components/budget-bar";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const { repo } = await requireContext();
  const [jobs, invoices] = await Promise.all([repo.listJobs(), repo.listInvoices()]);
  const rows = jobs.filter((j) => j.archived === showArchived).map((j) => jobCostSummary(j, invoices));

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Cost to date compared with each job's budget."
        actions={
          <>
            <Link href={showArchived ? "/jobs" : "/jobs?archived=1"} className={buttonVariants({ variant: "outline" })}>
              {showArchived ? "Show active jobs" : "Show archived"}
            </Link>
            <Link href="/jobs/new" className={buttonVariants()}>
              <Plus /> Add job
            </Link>
          </>
        }
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title={showArchived ? "No archived jobs" : "No jobs yet"}>
            {!showArchived && "Add your first job so invoices can be matched to it."}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th className="hidden md:table-cell">Customer</Th>
                <Th className="text-right">Contract</Th>
                <Th className="text-right">Cost to date</Th>
                <Th className="min-w-40">Budget used</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ job, totalCents, budgetCents, financeChargeCents }) => (
                <tr key={job.id} className="hover:bg-surface-2">
                  <Td>
                    <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                      {job.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {[job.jobNumber && `#${job.jobNumber}`, job.address, job.city].filter(Boolean).join(" · ")}
                    </div>
                    {financeChargeCents > 0 && (
                      <Badge tone="danger" className="mt-1">
                        Finance charges {formatMoney(financeChargeCents)}
                      </Badge>
                    )}
                  </Td>
                  <Td className="hidden md:table-cell">{job.customer ?? "-"}</Td>
                  <Td className="tabular text-right">{formatMoney(job.contractCents)}</Td>
                  <Td className="tabular text-right">{formatMoney(totalCents)}</Td>
                  <Td>
                    <BudgetBar spent={totalCents} budget={budgetCents} />
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
