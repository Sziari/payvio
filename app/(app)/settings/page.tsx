import Link from "next/link";
import { ChevronRight, Link2 } from "lucide-react";
import { features } from "@/config/features";
import { roles } from "@/config/workflows";
import { requireContext } from "@/lib/data/context";
import { setupStatus } from "@/lib/env";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { CompanyForm, InviteForm, SampleDataButton, TeamRow } from "./settings-forms";

export default async function SettingsPage() {
  const { repo, user } = await requireContext();
  const [company, members, connections] = await Promise.all([repo.getCompany(), repo.listMembers(), repo.listConnections()]);
  const setup = setupStatus();
  const isOwner = user.role === "owner";

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Link href="/settings/connections" className="lg:col-span-2">
          <Card className="flex items-center gap-4 p-4 hover:bg-surface-2">
            <span className="grid size-10 place-items-center rounded-lg bg-accent/20">
              <Link2 className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Connections: bank and QuickBooks</span>
              <span className="text-sm text-muted">
                {connections.length
                  ? connections.map((c) => c.displayName ?? (c.provider === "plaid" ? "Bank" : "QuickBooks")).join(", ")
                  : "Nothing connected yet. Connect your bank and QuickBooks in a few clicks."}
              </span>
            </span>
            <ChevronRight className="size-5 text-muted" />
          </Card>
        </Link>

        <Card>
          <CardHeader title="Company" />
          <CompanyForm company={company} disabled={!["owner", "office_manager"].includes(user.role)} />
          {features.emailInbox && (
            <p className="border-t border-border px-4 py-3 text-sm text-muted">
              Invoice email address:{" "}
              <span className="font-mono text-text">
                ap+{company.inboundSlug}@{setup.inboundDomain ?? "yourdomain.com"}
              </span>
              {!setup.inboundEmail && " (not set up yet)"}
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Team"
            description="Roles decide who approves invoices (see config/workflows.ts)."
          />
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <TeamRow key={m.userId} member={m} isMe={m.userId === user.id} canEdit={isOwner} roles={[...roles]} />
            ))}
          </ul>
          {isOwner && <InviteForm roles={[...roles]} />}
        </Card>

        {repo.mode === "live" && isOwner && (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Try it with sample data"
              description="Adds 5 sample jobs, invoices, customer payments and payroll to an empty company so you can look around."
            />
            <div className="p-4">
              <SampleDataButton />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
