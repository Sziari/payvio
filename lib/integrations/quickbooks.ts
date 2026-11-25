import "server-only";
import { appUrl } from "@/lib/env";
import { invoiceCostSplit } from "@/lib/calc";
import type { Repo } from "@/lib/data/repo";
import type { Invoice } from "@/lib/types";
import { getSecret, listConnectionsFor, markConnection, saveConnection, updateSecret } from "./store";

// QuickBooks Online: one-click OAuth connect, then
//  - import suppliers (Vendors) from QuickBooks
//  - send confirmed, approved invoices to QuickBooks as Bills (credits as Vendor Credits)

type QboTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms
  refreshExpiresAt: number; // ms
};

const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const SCOPE = "com.intuit.quickbooks.accounting";

export function quickbooksConfigured() {
  return !!process.env.INTUIT_CLIENT_ID && !!process.env.INTUIT_CLIENT_SECRET;
}

export function redirectUri() {
  return `${appUrl()}/api/quickbooks/callback`;
}

function apiBase() {
  return process.env.INTUIT_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

function basicAuth() {
  return "Basic " + Buffer.from(`${process.env.INTUIT_CLIENT_ID}:${process.env.INTUIT_CLIENT_SECRET}`).toString("base64");
}

export function authorizeUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.INTUIT_CLIENT_ID!,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTH_URL}?${p}`;
}

async function tokenRequest(body: Record<string, string>): Promise<QboTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(), Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`QuickBooks sign-in failed (${res.status}). Try connecting again.`);
  const j = await res.json();
  const now = Date.now();
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: now + (j.expires_in ?? 3600) * 1000,
    refreshExpiresAt: now + (j.x_refresh_token_expires_in ?? 8_640_000) * 1000,
  };
}

export class QboError extends Error {}

class QboClient {
  constructor(
    private companyId: string,
    private connectionId: string,
    private realmId: string,
    private tokens: QboTokens,
  ) {}

  private async token() {
    if (Date.now() < this.tokens.expiresAt - 60_000) return this.tokens.accessToken;
    try {
      this.tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: this.tokens.refreshToken });
    } catch {
      await markConnection(this.companyId, this.connectionId, { status: "needs_reauth", lastError: "QuickBooks needs you to connect again." });
      throw new QboError("QuickBooks needs you to connect again.");
    }
    await updateSecret(this.companyId, this.connectionId, { secret: this.tokens });
    return this.tokens.accessToken;
  }

  async request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const url = `${apiBase()}/v3/company/${encodeURIComponent(this.realmId)}/${path}${path.includes("?") ? "&" : "?"}minorversion=75`;
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    if (res.status === 401) {
      await markConnection(this.companyId, this.connectionId, { status: "needs_reauth", lastError: "QuickBooks needs you to connect again." });
      throw new QboError("QuickBooks needs you to connect again.");
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = json?.Fault?.Error?.[0];
      throw new QboError(detail ? `${detail.Message}${detail.Detail ? `: ${detail.Detail}` : ""}` : `QuickBooks error ${res.status}`);
    }
    return json as T;
  }

  query<T>(q: string) {
    return this.request<{ QueryResponse: T }>(`query?query=${encodeURIComponent(q)}`);
  }
}

export async function connectFromCallback(companyId: string, code: string, realmId: string) {
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  const connectionId = await saveConnection(companyId, "quickbooks", realmId, null, tokens);
  const qbo = new QboClient(companyId, connectionId, realmId, tokens);
  try {
    const info = await qbo.request<{ CompanyInfo: { CompanyName: string } }>(`companyinfo/${encodeURIComponent(realmId)}`);
    await saveConnection(companyId, "quickbooks", realmId, info.CompanyInfo.CompanyName, tokens);
  } catch {
    // name is optional
  }
  await markConnection(companyId, connectionId, { lastSyncedAt: new Date().toISOString() });
  return connectionId;
}

export async function getQbo(companyId: string) {
  const [conn] = await listConnectionsFor(companyId, "quickbooks");
  if (!conn) return null;
  const { secret } = await getSecret<QboTokens>(companyId, conn.id);
  return { conn, client: new QboClient(companyId, conn.id, conn.externalId, secret) };
}

export type QboAccount = { id: string; name: string; type: string };

export async function listExpenseAccounts(companyId: string): Promise<QboAccount[]> {
  const q = await getQbo(companyId);
  if (!q) return [];
  const res = await q.client.query<{ Account?: { Id: string; Name: string; AccountType: string; Active: boolean }[] }>(
    "select * from Account where AccountType in ('Expense', 'Cost of Goods Sold', 'Other Expense') maxresults 1000",
  );
  return (res.QueryResponse.Account ?? [])
    .filter((a) => a.Active !== false)
    .map((a) => ({ id: a.Id, name: a.Name, type: a.AccountType }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type QboVendor = { Id: string; DisplayName: string };

async function allVendors(client: QboClient): Promise<QboVendor[]> {
  const out: QboVendor[] = [];
  for (let start = 1; start < 20_000; start += 1000) {
    const res = await client.query<{ Vendor?: QboVendor[] }>(`select Id, DisplayName from Vendor startposition ${start} maxresults 1000`);
    const page = res.QueryResponse.Vendor ?? [];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

/** Import QuickBooks vendors into Payvio and link the ones with the same name. */
export async function importVendors(repo: Repo): Promise<{ created: number; linked: number }> {
  const q = await getQbo(repo.companyId);
  if (!q) throw new QboError("QuickBooks is not connected.");
  const local = await repo.listVendors();
  let created = 0;
  let linked = 0;
  for (const v of await allVendors(q.client)) {
    const match = local.find((l) => l.name.toLowerCase() === v.DisplayName.toLowerCase());
    if (match) {
      if (match.qboVendorId !== v.Id) {
        await repo.updateVendor(match.id, { qboVendorId: v.Id });
        linked++;
      }
    } else {
      const nv = await repo.ensureVendor(v.DisplayName);
      await repo.updateVendor(nv.id, { qboVendorId: v.Id });
      created++;
    }
  }
  await markConnection(repo.companyId, q.conn.id, { lastSyncedAt: new Date().toISOString(), lastError: null });
  return { created, linked };
}

export function readyForQuickBooks(inv: Invoice) {
  return !!inv.confirmedAt && !inv.qboBillId && ["Approved", "Scheduled", "Paid"].includes(inv.status) && inv.totalCents !== 0;
}

/** Send confirmed, approved invoices to QuickBooks. */
export async function pushBills(repo: Repo): Promise<{ sent: number; errors: string[] }> {
  const q = await getQbo(repo.companyId);
  if (!q) throw new QboError("QuickBooks is not connected.");
  const company = await repo.getCompany();
  const map = company.qboExpenseAccounts;
  const [invoices, vendors, jobs] = await Promise.all([repo.listInvoices(), repo.listVendors(), repo.listJobs()]);
  const jobName = new Map(jobs.map((j) => [j.id, j.name]));
  const qboVendors = await allVendors(q.client);
  const errors: string[] = [];
  let sent = 0;

  for (const inv of invoices.filter(readyForQuickBooks)) {
    const label = `${inv.vendorName ?? "Supplier"} #${inv.invoiceNumber ?? "?"}`;
    try {
      // Supplier
      const local = vendors.find((v) => v.id === inv.vendorId);
      let qboVendorId = local?.qboVendorId ?? null;
      if (!qboVendorId) {
        const name = (inv.vendorName ?? "Unknown supplier").slice(0, 100);
        const found = qboVendors.find((v) => v.DisplayName.toLowerCase() === name.toLowerCase());
        if (found) qboVendorId = found.Id;
        else {
          const created = await q.client.request<{ Vendor: QboVendor }>("vendor", { method: "POST", body: { DisplayName: name } });
          qboVendorId = created.Vendor.Id;
          qboVendors.push(created.Vendor);
        }
        if (local) await repo.updateVendor(local.id, { qboVendorId });
      }

      // Lines by cost type -> mapped expense account
      const split = [...invoiceCostSplit(inv).entries()].filter(([, c]) => c !== 0);
      const credit = inv.totalCents < 0;
      const lines = split.map(([type, cents]) => {
        const account = map[type] || map.default;
        if (!account) throw new QboError(`Pick a QuickBooks account for "${type}" in Settings → Connections.`);
        if (!credit && cents < 0) throw new QboError("has a negative line; enter this one in QuickBooks by hand.");
        return {
          DetailType: "AccountBasedExpenseLineDetail",
          Amount: Math.abs(cents) / 100,
          Description: `${type}${inv.jobId ? ` - ${jobName.get(inv.jobId) ?? ""}` : ""}`.slice(0, 4000),
          AccountBasedExpenseLineDetail: { AccountRef: { value: account } },
        };
      });
      const body = {
        VendorRef: { value: qboVendorId },
        TxnDate: inv.invoiceDate ?? undefined,
        ...(credit ? {} : { DueDate: inv.dueDate ?? undefined }),
        DocNumber: inv.invoiceNumber?.slice(0, 21) ?? undefined,
        PrivateNote: `From Payvio${inv.jobId ? ` · Job: ${jobName.get(inv.jobId)}` : ""}`.slice(0, 4000),
        Line: lines,
      };
      const res = credit
        ? await q.client.request<{ VendorCredit: { Id: string } }>("vendorcredit", { method: "POST", body })
        : await q.client.request<{ Bill: { Id: string } }>("bill", { method: "POST", body });
      const id = "Bill" in res ? res.Bill.Id : res.VendorCredit.Id;
      await repo.updateInvoice(inv.id, { qboBillId: id });
      sent++;
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : "failed"}`);
      if (e instanceof QboError && e.message.includes("connect again")) break;
    }
  }
  await markConnection(repo.companyId, q.conn.id, {
    lastSyncedAt: new Date().toISOString(),
    lastError: errors.length ? errors[0] : null,
  });
  return { sent, errors };
}

export async function revokeQuickBooks(companyId: string, connectionId: string) {
  try {
    const { secret } = await getSecret<QboTokens>(companyId, connectionId);
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { Authorization: basicAuth(), Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ token: secret.refreshToken }),
    });
  } catch {
    // Already disconnected on Intuit's side.
  }
}
