import { requireContext } from "@/lib/data/context";
import { cashOnHandCents } from "@/lib/calc";
import { todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { ForecastView } from "./forecast-view";
import { ForecastInputs } from "./forecast-inputs";

export default async function ForecastPage() {
  const { repo } = await requireContext();
  const [company, payments, recurring, invoices, accounts, jobs] = await Promise.all([
    repo.getCompany(),
    repo.listPayments(),
    repo.listRecurring(),
    repo.listInvoices(),
    repo.listBankAccounts(),
    repo.listJobs(),
  ]);
  const cash = cashOnHandCents(company, accounts);

  return (
    <>
      <PageHeader
        title="Cash Forecast"
        description="The next 13 weeks: money coming in from customers, minus payroll, loans, leases and supplier bills."
      />
      <ForecastView
        today={todayISO()}
        startingCashCents={cash.cents}
        cashSource={cash.source}
        minCashCents={company.minCashCents}
        payments={payments}
        recurring={recurring}
        invoices={invoices}
      />
      <ForecastInputs
        company={company}
        cashSource={cash.source}
        payments={payments}
        recurring={recurring}
        jobs={jobs.filter((j) => !j.archived)}
      />
    </>
  );
}
