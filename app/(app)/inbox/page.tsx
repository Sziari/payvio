import Link from "next/link";
import { AlertTriangle, Mail } from "lucide-react";
import { features } from "@/config/features";
import { invoiceWorkflow } from "@/config/workflows";
import { requireContext } from "@/lib/data/context";
import { INBOX_STATUSES, pendingApprovals } from "@/lib/approvals";
import { expiringDiscounts } from "@/lib/calc";
import { formatDate, todayISO } from "@/lib/dates";
import { findDuplicate } from "@/lib/duplicates";
import { setupStatus } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/types";
import { Uploader } from "./uploader";

const TABS = [
  { key: "review", label: "To review", match: (i: Invoice) => INBOX_STATUSES.includes(i.status) },
  { key: "open", label: "To pay", match: (i: Invoice) => i.status === "Approved" || i.status === "Scheduled" },
  { key: "paid", label: "Paid", match: (i: Invoice) => i.status === "Paid" },
  { key: "disputed", label: "Disputed", match: (i: Invoice) => i.status === "Disputed" },
  { key: "all", label: "All", match: () => true },
] as const;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.key === tabParam) ?? TABS[0];
  const { repo } = await requireContext();
  const [invoices, jobs, company] = await Promise.all([repo.listInvoices(), repo.listJobs(), repo.getCompany()]);
  const jobName = new Map(jobs.map((j) => [j.id, j.name]));
  const rows = invoices.filter(tab.match);
  const setup = setupStatus();
  const discounts = expiringDiscounts(invoices, invoiceWorkflow.earlyPayDiscountAlertDays);
  const today = todayISO();

  return (
    <>
      <PageHeader title="AP Inbox" description="Upload supplier invoices. The AI fills in the details; you check and confirm." />

      {!setup.anthropic && (
        <Notice className="mb-4" title="AI reading is not turned on yet">
          Invoices will still upload, but you&apos;ll type the details yourself. Add an Anthropic API key to turn it on (
          <Link href="/settings/connections" className="underline">
            how
          </Link>
          ).
        </Notice>
      )}

      {discounts.length > 0 && (
        <Notice className="mb-4" title="Early-pay discounts ending soon">
          <ul className="list-disc pl-5">
            {discounts.map((d) => (
              <li key={d.id}>
                <Link href={`/inbox/${d.id}`} className="underline">
                  {d.vendorName} #{d.invoiceNumber}
                </Link>
                : pay by {formatDate(d.discountDueDate)} to save {d.discountPercent}% (
                {formatMoney(Math.round((d.totalCents * (d.discountPercent ?? 0)) / 100))})
              </li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Uploader />
        </div>
        {features.emailInbox && (
          <Card className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="size-4" /> Email invoices in
            </p>
            {setup.inboundEmail ? (
              <>
                <p className="mt-2 text-sm text-muted">Ask suppliers to send invoices to, or forward them to:</p>
                <p className="mt-2 break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">
                  ap+{company.inboundSlug}@{setup.inboundDomain}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Not set up yet. Once it is, you&apos;ll get an address like{" "}
                <span className="font-mono">ap+{company.inboundSlug}@yourdomain.com</span>. See{" "}
                <Link href="/settings/connections" className="underline">
                  Settings → Connections
                </Link>
                .
              </p>
            )}
          </Card>
        )}
      </div>

      <div className="mb-3 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const count = invoices.filter(t.match).length;
          return (
            <Link
              key={t.key}
              href={`/inbox?tab=${t.key}`}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2",
                t.key === tab.key && "bg-surface text-text shadow-sm ring-1 ring-border",
              )}
            >
              {t.label} <span className="text-xs">({count})</span>
            </Link>
          );
        })}
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title={tab.key === "review" ? "Nothing to review" : "No invoices here"}>
            {tab.key === "review" && "New uploads show up here for you to check."}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Supplier</Th>
                <Th className="hidden sm:table-cell">Invoice #</Th>
                <Th className="hidden md:table-cell">Date</Th>
                <Th className="hidden lg:table-cell">Job</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const dup = findDuplicate(inv, invoices);
                const waiting = inv.confirmedAt ? pendingApprovals(inv) : [];
                const overdue = inv.dueDate && inv.dueDate < today && (inv.status === "Approved" || inv.status === "Scheduled");
                return (
                  <tr key={inv.id} className="hover:bg-surface-2">
                    <Td>
                      <Link href={`/inbox/${inv.id}`} className="font-medium hover:underline">
                        {inv.vendorName ?? inv.fileName ?? "New invoice"}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {dup && (
                          <Badge tone="danger">
                            <AlertTriangle className="mr-1 size-3" /> Possible duplicate
                          </Badge>
                        )}
                        {inv.extractionError && <Badge tone="accent">Check by hand</Badge>}
                        {inv.isFinanceCharge && invoiceWorkflow.flagFinanceCharges && <Badge tone="danger">Finance charge</Badge>}
                        {inv.isCreditMemo && <Badge tone="success">Credit</Badge>}
                        {overdue && <Badge tone="danger">Past due</Badge>}
                        {waiting.length > 0 && <Badge tone="accent">Needs {waiting[0].role.replace("_", " ")} approval</Badge>}
                      </div>
                    </Td>
                    <Td className="hidden sm:table-cell">{inv.invoiceNumber ?? "-"}</Td>
                    <Td className="hidden whitespace-nowrap md:table-cell">{formatDate(inv.invoiceDate)}</Td>
                    <Td className="hidden lg:table-cell">
                      {inv.jobId ? jobName.get(inv.jobId) : <span className="text-muted">Not picked</span>}
                    </Td>
                    <Td>
                      <StatusBadge status={inv.status} />
                    </Td>
                    <Td className="tabular text-right">{formatMoney(inv.totalCents)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
