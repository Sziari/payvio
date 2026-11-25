import { revalidatePath } from "next/cache";
import { defaultDashboard, type WidgetPlacement } from "@/config/dashboard";
import { invoiceWorkflow } from "@/config/workflows";
import { brand } from "@/config/brand";
import { requireContext } from "@/lib/data/context";
import { INBOX_STATUSES } from "@/lib/approvals";
import { cashOnHandCents, computeKpis, costByMonth, jobCostSummary, vendorBalances } from "@/lib/calc";
import { todayISO } from "@/lib/dates";
import { findDuplicate } from "@/lib/duplicates";
import { buildForecast } from "@/lib/forecast";
import { Notice, PageHeader } from "@/components/ui";
import { DashboardGrid } from "@/components/widgets/dashboard-grid";
import type { DashboardData } from "@/components/widgets/types";

async function saveLayout(layout: WidgetPlacement[] | null) {
  "use server";
  const { repo } = await requireContext();
  // Keep only well-formed placements
  const clean = layout
    ?.filter((p) => typeof p.id === "string" && typeof p.widget === "string")
    .map((p) => ({
      id: p.id.slice(0, 80),
      widget: p.widget.slice(0, 60),
      title: String(p.title ?? "").slice(0, 80),
      x: Math.max(0, Math.min(11, Math.round(p.x))),
      y: Math.max(0, Math.round(p.y)),
      w: Math.max(1, Math.min(12, Math.round(p.w))),
      h: Math.max(1, Math.min(20, Math.round(p.h))),
      ...(typeof p.props?.metric === "string" ? { props: { metric: p.props.metric.slice(0, 40) } } : {}),
    }))
    .slice(0, 40);
  await repo.saveLayout(clean ?? null);
  revalidatePath("/dashboard");
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const { repo } = await requireContext();
  const [company, invoices, jobs, payments, recurring, accounts, saved] = await Promise.all([
    repo.getCompany(),
    repo.listInvoices(),
    repo.listJobs(),
    repo.listPayments(),
    repo.listRecurring(),
    repo.listBankAccounts(),
    repo.getLayout(),
  ]);
  const today = todayISO();
  const cash = cashOnHandCents(company, accounts);
  const inbox = invoices.filter((i) => INBOX_STATUSES.includes(i.status));

  const data: DashboardData = {
    kpis: computeKpis({ company, accounts, invoices, payments, recurring, today }),
    minCashCents: company.minCashCents,
    forecast: buildForecast({
      today,
      startingCashCents: cash.cents,
      minCashCents: company.minCashCents,
      payments,
      recurring,
      invoices,
    }).map(({ start, endingCents, belowMin, inflowCents, outflowCents }) => ({ start, endingCents, belowMin, inflowCents, outflowCents })),
    inbox: inbox.slice(0, 20).map((i) => ({
      id: i.id,
      vendor: i.vendorName ?? i.fileName ?? "New invoice",
      totalCents: i.totalCents,
      status: i.status,
      flag: findDuplicate(i, invoices)
        ? "Possible duplicate"
        : i.isFinanceCharge && invoiceWorkflow.flagFinanceCharges
          ? "Finance charge"
          : null,
    })),
    inboxCount: inbox.length,
    jobCosts: jobs
      .filter((j) => !j.archived)
      .map((j) => {
        const s = jobCostSummary(j, invoices);
        return { id: j.id, name: j.name, totalCents: s.totalCents, budgetCents: s.budgetCents, contractCents: j.contractCents };
      }),
    vendorBalances: vendorBalances(invoices).slice(0, 15),
    materialByMonth: costByMonth(invoices, { costType: "Material", months: 6, today }),
  };

  return (
    <>
      <PageHeader title="Dashboard" description={`${company.name} · ${brand.tagline}`} />
      {welcome && (
        <Notice tone="success" className="mb-4" title={`Welcome to ${brand.name}!`}>
          Start by adding your jobs, then upload a few supplier invoices. You can also load sample data from Settings to look around.
        </Notice>
      )}
      <DashboardGrid data={data} layout={saved ?? defaultDashboard} isCustom={!!saved} onSave={saveLayout} />
    </>
  );
}
