import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireContext } from "@/lib/data/context";
import { canApproveStep, pendingApprovals } from "@/lib/approvals";
import { formatDate } from "@/lib/dates";
import { findDuplicate } from "@/lib/duplicates";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, Notice } from "@/components/ui";
import { StatusBadge } from "@/components/ui/status-badge";
import { ReviewForm } from "./review-form";

export default async function InvoiceReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { repo, user } = await requireContext();
  const [inv, jobs, all, members] = await Promise.all([
    repo.getInvoice(id),
    repo.listJobs(),
    repo.listInvoices(),
    repo.listMembers(),
  ]);
  if (!inv) notFound();

  const dup = findDuplicate(inv, all);
  const dupInvoice = dup ? all.find((i) => i.id === dup.id) : null;
  const pending = inv.confirmedAt ? pendingApprovals(inv) : [];
  const canApprove = pending.some((s) => canApproveStep(user.role, s));
  const who = new Map(members.map((m) => [m.userId, m.email ?? "a teammate"]));
  const fileUrl = `/api/invoices/${inv.id}/file`;
  const isPdf = inv.fileMime === "application/pdf";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/inbox" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
          <ArrowLeft className="size-4" /> AP Inbox
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={inv.status} />
          {inv.source === "email" && <span className="text-xs text-muted">Arrived by email</span>}
        </div>
      </div>

      {dupInvoice && (
        <Notice tone="danger" title="This may be a duplicate" className="mb-4">
          {dupInvoice.vendorName} invoice #{dupInvoice.invoiceNumber} is already in {""}
          <Link href={`/inbox/${dupInvoice.id}`} className="font-medium underline">
            the system ({dupInvoice.status}, {formatMoney(dupInvoice.totalCents)})
          </Link>
          . Check before confirming so it isn&apos;t paid twice.
        </Notice>
      )}
      {inv.extractionError && !inv.confirmedAt && (
        <Notice className="mb-4" title="Please check this one by hand">
          {inv.extractionError}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: the original document */}
        <Card className="overflow-hidden lg:sticky lg:top-6 lg:self-start">
          <CardHeader
            title="Original document"
            description={inv.fileName ?? undefined}
            action={
              inv.filePath ? (
                <a href={fileUrl} target="_blank" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
                  Open <ExternalLink className="size-3.5" />
                </a>
              ) : null
            }
          />
          {inv.filePath ? (
            isPdf ? (
              <iframe src={fileUrl} title="Invoice document" className="h-[50vh] w-full bg-white lg:h-[75vh]" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl} alt="Invoice" className="max-h-[75vh] w-full bg-white object-contain" />
            )
          ) : (
            <div className="p-6 text-sm text-muted">
              This is sample data, so there is no original file. Uploaded invoices always keep their original here.
            </div>
          )}
        </Card>

        {/* Right: extracted fields to check */}
        <div>
          <ReviewForm
            invoice={inv}
            jobs={jobs.filter((j) => !j.archived || j.id === inv.jobId)}
            canApprove={canApprove}
            pendingRoles={pending.map((p) => p.role)}
          />
          {inv.approvals.length > 0 && (
            <Card className="mt-6">
              <CardHeader title="Approvals" />
              <ul className="divide-y divide-border text-sm">
                {inv.approvals.map((a, i) => (
                  <li key={i} className="flex justify-between px-4 py-2">
                    <span className="capitalize">{a.role.replace("_", " ")}</span>
                    <span className="text-muted">
                      {who.get(a.userId) ?? "Approved"} · {formatDate(a.at.slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
