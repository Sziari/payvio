import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { features } from "@/config/features";
import { costTypes } from "@/config/workflows";
import { requireContext } from "@/lib/data/context";
import { formatDate } from "@/lib/dates";
import { setupStatus } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { listExpenseAccounts, readyForQuickBooks, redirectUri, type QboAccount } from "@/lib/integrations/quickbooks";
import { Badge, Button, Card, CardHeader, Notice, PageHeader, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { qboImportVendors, qboPushBills, saveAccountMapping } from "./actions";
import { ActionButton, DisconnectButton, IncludeToggle, PlaidConnectButton, SyncBankButton } from "./connect-buttons";
import { MappingForm } from "./mapping-form";

const QBO_MESSAGES: Record<string, { tone: "success" | "danger" | "accent"; text: string }> = {
  connected: { tone: "success", text: "QuickBooks is connected." },
  cancelled: { tone: "accent", text: "QuickBooks connection was cancelled." },
  expired: { tone: "danger", text: "That sign-in took too long or came from another tab. Please press Connect again." },
  failed: { tone: "danger", text: "QuickBooks didn't finish connecting. Please try again." },
  "in-use": { tone: "danger", text: "That QuickBooks company is already connected to a different Payvio account." },
  "not-configured": { tone: "accent", text: "QuickBooks keys aren't set yet. See the steps below." },
  "not-allowed": { tone: "danger", text: "Only the owner or office manager can connect QuickBooks." },
};

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted" />}
      <span className={cn(done && "text-muted line-through")}>{children}</span>
    </li>
  );
}

function Env({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{children}</code>;
}

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ qbo?: string }> }) {
  const { qbo: qboParam } = await searchParams;
  const { repo, user } = await requireContext();
  const setup = setupStatus();
  const canManage = ["owner", "office_manager"].includes(user.role);
  const [connections, accounts, transactions, invoices, company] = await Promise.all([
    repo.listConnections(),
    repo.listBankAccounts(),
    repo.listBankTransactions(15),
    repo.listInvoices(),
    repo.getCompany(),
  ]);
  const banks = connections.filter((c) => c.provider === "plaid");
  const qbo = connections.find((c) => c.provider === "quickbooks");
  const toSend = invoices.filter(readyForQuickBooks).length;
  let qboAccounts: QboAccount[] = [];
  let qboAccountsError: string | null = null;
  if (qbo && setup.quickbooks) {
    try {
      qboAccounts = await listExpenseAccounts(repo.companyId);
    } catch (e) {
      qboAccountsError = e instanceof Error ? e.message : "Couldn't load QuickBooks accounts.";
    }
  }
  const qboMsg = qboParam ? QBO_MESSAGES[qboParam] : null;

  return (
    <>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Settings
      </Link>
      <PageHeader title="Connections" description="Connect your bank and QuickBooks so you don't have to type numbers twice." />
      {qboMsg && (
        <Notice tone={qboMsg.tone} className="mb-4">
          {qboMsg.text}
        </Notice>
      )}
      {!canManage && (
        <Notice tone="neutral" className="mb-4">
          Only the owner or office manager can connect or disconnect accounts.
        </Notice>
      )}

      <div className="space-y-6">
        {/* ---------------- Bank ---------------- */}
        {features.bankFeed && (
          <Card>
            <CardHeader
              title="Bank accounts"
              description="Your real bank balance becomes 'cash on hand' on the dashboard and the starting point of the forecast."
              action={banks.length > 0 ? <SyncBankButton /> : null}
            />
            <div className="p-4">
              {!setup.plaid ? (
                <Notice title="One-time setup needed (about 15 minutes)">
                  <p>Bank connections go through Plaid, the service most finance apps use. To turn it on:</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>
                      Sign up free at{" "}
                      <a href="https://dashboard.plaid.com/signup" target="_blank" className="underline">
                        dashboard.plaid.com
                      </a>
                      .
                    </li>
                    <li>Copy your <b>client_id</b> and <b>Sandbox secret</b> from Developers → Keys.</li>
                    <li>
                      Add them as <Env>PLAID_CLIENT_ID</Env> and <Env>PLAID_SECRET</Env> (and <Env>PLAID_ENV=sandbox</Env>) in
                      .env.local and in Vercel, then restart.
                    </li>
                    <li>Test with Plaid&apos;s sandbox bank (username <Env>user_good</Env>, password <Env>pass_good</Env>). Ask Plaid for production access before using real banks.</li>
                  </ol>
                </Notice>
              ) : (
                <>
                  {banks.length === 0 && (
                    <p className="mb-4 text-sm text-muted">
                      Press the button, pick your bank, and sign in on Plaid&apos;s secure screen. {""}
                      Payvio never sees your bank password and can only read balances and transactions, never move money.
                    </p>
                  )}
                  {banks.map((b) => {
                    const accts = accounts.filter((a) => a.connectionId === b.id);
                    return (
                      <div key={b.id} className="mb-4 rounded-lg border border-border">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                          <div>
                            <p className="font-medium">{b.displayName ?? "Bank"}</p>
                            <p className="text-xs text-muted">
                              {b.lastSyncedAt ? `Updated ${formatDate(b.lastSyncedAt.slice(0, 10))}` : "Not updated yet"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-start gap-2">
                            {b.status !== "active" && <Badge tone="danger">{b.status === "needs_reauth" ? "Needs sign-in" : "Error"}</Badge>}
                            {canManage && b.status === "needs_reauth" && <PlaidConnectButton reconnectId={b.id} label="Reconnect" />}
                            {canManage && <DisconnectButton id={b.id} name={b.displayName ?? "this bank"} />}
                          </div>
                        </div>
                        {b.lastError && <p className="px-4 pt-2 text-xs text-danger">{b.lastError}</p>}
                        <ul className="divide-y divide-border">
                          {accts.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                              <span>
                                {a.name} {a.mask && <span className="text-muted">••{a.mask}</span>}
                                <span className="ml-2 text-xs capitalize text-muted">{a.subtype ?? a.type}</span>
                              </span>
                              <span className="flex items-center gap-4">
                                <IncludeToggle id={a.id} included={a.includeInCash} />
                                <span className="tabular font-medium">{formatMoney(a.availableCents ?? a.currentCents)}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                  {canManage && <PlaidConnectButton label={banks.length ? "Connect another bank" : "Connect your bank"} />}
                  {transactions.length > 0 && (
                    <details className="mt-4 text-sm">
                      <summary className="cursor-pointer font-medium">Recent bank transactions</summary>
                      <ul className="mt-2 divide-y divide-border">
                        {transactions.map((t) => (
                          <li key={t.id} className="flex justify-between gap-2 py-1.5">
                            <span className="min-w-0 truncate">
                              <span className="text-muted">{formatDate(t.date)}</span> · {t.name}
                              {t.pending && <Badge className="ml-2">Pending</Badge>}
                            </span>
                            {/* Plaid: positive = money out */}
                            <span className={cn("tabular shrink-0", t.amountCents > 0 ? "text-danger" : "text-success")}>
                              {formatMoney(-t.amountCents)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          </Card>
        )}

        {/* ---------------- QuickBooks ---------------- */}
        {features.quickbooksSync && (
          <Card>
            <CardHeader
              title="QuickBooks Online"
              description="Send confirmed invoices to QuickBooks as bills, and bring your supplier list over."
            />
            <div className="p-4">
              {!setup.quickbooks ? (
                <Notice title="One-time setup needed (about 20 minutes)">
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>
                      Sign in at{" "}
                      <a href="https://developer.intuit.com" target="_blank" className="underline">
                        developer.intuit.com
                      </a>{" "}
                      with any Intuit account and create an app (choose &quot;QuickBooks Online and Payments&quot;, scope
                      &quot;Accounting&quot;).
                    </li>
                    <li>
                      Under Keys &amp; credentials → Redirect URIs, add: <Env>{redirectUri()}</Env>
                    </li>
                    <li>
                      Copy the Client ID and Client Secret into <Env>INTUIT_CLIENT_ID</Env> and <Env>INTUIT_CLIENT_SECRET</Env>, with{" "}
                      <Env>INTUIT_ENVIRONMENT=sandbox</Env> to test.
                    </li>
                    <li>Restart the app. A &quot;Connect to QuickBooks&quot; button appears here.</li>
                  </ol>
                </Notice>
              ) : !qbo ? (
                <div>
                  <p className="mb-4 text-sm text-muted">
                    You&apos;ll sign in to QuickBooks and pick your company. Payvio only adds bills and suppliers; it never deletes
                    anything in QuickBooks.
                  </p>
                  {canManage ? (
                    // A plain link: the browser goes to Intuit and comes back.
                    <a href="/api/quickbooks/connect" className={buttonVariants({ size: "lg", variant: "success" })}>
                      Connect to QuickBooks
                    </a>
                  ) : (
                    <Button disabled>Connect to QuickBooks</Button>
                  )}
                  {setup.quickbooksEnv === "sandbox" && (
                    <p className="mt-2 text-xs text-muted">Test mode: connects to an Intuit sandbox company.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {qbo.displayName ?? "QuickBooks company"}{" "}
                        {qbo.status === "active" ? <Badge tone="success">Connected</Badge> : <Badge tone="danger">Connect again</Badge>}
                      </p>
                      <p className="text-xs text-muted">
                        {qbo.lastSyncedAt ? `Last sync ${formatDate(qbo.lastSyncedAt.slice(0, 10))}` : ""}
                      </p>
                      {qbo.lastError && <p className="mt-1 text-xs text-danger">{qbo.lastError}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {qbo.status !== "active" && canManage && (
                        <a href="/api/quickbooks/connect" className={buttonVariants({ size: "sm" })}>
                          Connect again
                        </a>
                      )}
                      {canManage && <DisconnectButton id={qbo.id} name="QuickBooks" />}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap gap-3">
                      <ActionButton action={qboImportVendors} icon="sync">
                        Import suppliers
                      </ActionButton>
                      <ActionButton action={qboPushBills} variant="primary">
                        Send {toSend} bill{toSend === 1 ? "" : "s"} to QuickBooks
                      </ActionButton>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium">Which QuickBooks account should each cost type go to?</p>
                    <p className="mb-3 text-xs text-muted">Set a default, and change any cost type that should go somewhere else.</p>
                    {qboAccountsError ? (
                      <Notice tone="danger">{qboAccountsError}</Notice>
                    ) : (
                      <MappingForm
                        accounts={qboAccounts}
                        mapping={company.qboExpenseAccounts}
                        costTypes={[...costTypes]}
                        action={saveAccountMapping}
                        disabled={!canManage}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ---------------- Other services ---------------- */}
        <Card>
          <CardHeader title="Setup checklist" description="What's turned on for this app." />
          <ul className="space-y-2 p-4 text-sm">
            <Step done={setup.supabase}>
              Database and sign-in (Supabase): <Env>NEXT_PUBLIC_SUPABASE_URL</Env>, <Env>NEXT_PUBLIC_SUPABASE_ANON_KEY</Env>,{" "}
              <Env>SUPABASE_SERVICE_ROLE_KEY</Env>. Without it the app runs on sample data.
            </Step>
            <Step done={setup.anthropic}>
              AI invoice reading: <Env>ANTHROPIC_API_KEY</Env> from console.anthropic.com
            </Step>
            <Step done={setup.encryption}>
              Token encryption: <Env>TOKEN_ENCRYPTION_KEY</Env> (any long random text)
            </Step>
            <Step done={setup.plaid}>Bank connections: Plaid keys (above)</Step>
            <Step done={setup.quickbooks}>QuickBooks: Intuit keys (above)</Step>
            <Step done={setup.inboundEmail}>
              Email-in invoices: <Env>INBOUND_EMAIL_DOMAIN</Env> and <Env>INBOUND_EMAIL_SECRET</Env> with Postmark inbound
            </Step>
          </ul>
          <div className="border-t border-border px-4 py-3 text-sm">
            <a
              href="https://github.com/Sziari/payvio/blob/main/docs/SETUP.md"
              target="_blank"
              className="inline-flex items-center gap-1 font-medium hover:underline"
            >
              <BookOpen className="size-4" /> Step-by-step setup guide <ExternalLink className="size-3" />
            </a>
          </div>
        </Card>
      </div>
    </>
  );
}
