import "server-only";
import { isDemo } from "@/lib/env";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { demoStore } from "@/lib/data/demo";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Connection } from "@/lib/types";

// Server-only storage for connections and their encrypted tokens.
// In live mode this uses the service role (tokens are invisible to users through RLS),
// so every function takes the companyId from the signed-in user's context and filters by it.

export type Provider = Connection["provider"];

export type BankAccountInput = {
  plaidAccountId: string;
  name: string;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  currentCents: number | null;
  availableCents: number | null;
};

export type TransactionInput = {
  plaidTransactionId: string;
  plaidAccountId: string;
  date: string;
  name: string;
  amountCents: number;
  pending: boolean;
};

export async function saveConnection(
  companyId: string,
  provider: Provider,
  externalId: string,
  displayName: string | null,
  secret: unknown,
): Promise<string> {
  const encrypted = encryptJson(secret);
  if (isDemo) {
    const s = demoStore();
    let c = s.connections.find((x) => x.provider === provider && x.externalId === externalId);
    if (!c) {
      c = { id: crypto.randomUUID(), provider, externalId, displayName, status: "active", lastSyncedAt: null, lastError: null };
      s.connections.push(c);
    }
    Object.assign(c, { displayName, status: "active", lastError: null });
    s.secrets.set(c.id, { encrypted, cursor: null });
    return c.id;
  }
  const db = createSupabaseAdmin();
  const existing = await db.from("connections").select("id, company_id").eq("provider", provider).eq("external_id", externalId).maybeSingle();
  if (existing.data && existing.data.company_id !== companyId) {
    throw new Error("This account is already connected to a different company.");
  }
  const up = await db
    .from("connections")
    .upsert(
      { company_id: companyId, provider, external_id: externalId, display_name: displayName, status: "active", last_error: null },
      { onConflict: "provider,external_id" },
    )
    .select("id")
    .single();
  if (up.error) throw new Error(up.error.message);
  const sec = await db
    .from("connection_secrets")
    .upsert({ connection_id: up.data.id, company_id: companyId, encrypted, updated_at: new Date().toISOString() });
  if (sec.error) throw new Error(sec.error.message);
  return up.data.id as string;
}

export async function listConnectionsFor(companyId: string, provider: Provider): Promise<Connection[]> {
  if (isDemo) return demoStore().connections.filter((c) => c.provider === provider);
  const db = createSupabaseAdmin();
  const { data, error } = await db.from("connections").select("*").eq("company_id", companyId).eq("provider", provider);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id, provider: r.provider, externalId: r.external_id, displayName: r.display_name,
    status: r.status, lastSyncedAt: r.last_synced_at, lastError: r.last_error,
  }));
}

export async function getSecret<T>(companyId: string, connectionId: string): Promise<{ secret: T; cursor: string | null }> {
  if (isDemo) {
    const row = demoStore().secrets.get(connectionId);
    if (!row) throw new Error("Connection not found");
    return { secret: decryptJson<T>(row.encrypted), cursor: row.cursor };
  }
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("connection_secrets")
    .select("encrypted, cursor")
    .eq("connection_id", connectionId)
    .eq("company_id", companyId)
    .single();
  if (error || !data) throw new Error("Connection not found");
  return { secret: decryptJson<T>(data.encrypted), cursor: data.cursor };
}

export async function updateSecret(companyId: string, connectionId: string, patch: { secret?: unknown; cursor?: string | null }) {
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.secret !== undefined) values.encrypted = encryptJson(patch.secret);
  if (patch.cursor !== undefined) values.cursor = patch.cursor;
  if (isDemo) {
    const row = demoStore().secrets.get(connectionId);
    if (!row) return;
    if (values.encrypted) row.encrypted = values.encrypted as string;
    if (patch.cursor !== undefined) row.cursor = patch.cursor;
    return;
  }
  const db = createSupabaseAdmin();
  const { error } = await db.from("connection_secrets").update(values).eq("connection_id", connectionId).eq("company_id", companyId);
  if (error) throw new Error(error.message);
}

export async function markConnection(
  companyId: string,
  connectionId: string,
  patch: { status?: Connection["status"]; lastSyncedAt?: string; lastError?: string | null },
) {
  if (isDemo) {
    const c = demoStore().connections.find((x) => x.id === connectionId);
    if (c) Object.assign(c, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
    return;
  }
  const values: Record<string, unknown> = {};
  if (patch.status) values.status = patch.status;
  if (patch.lastSyncedAt) values.last_synced_at = patch.lastSyncedAt;
  if (patch.lastError !== undefined) values.last_error = patch.lastError;
  const db = createSupabaseAdmin();
  await db.from("connections").update(values).eq("id", connectionId).eq("company_id", companyId);
}

export async function deleteConnection(companyId: string, connectionId: string) {
  if (isDemo) {
    const s = demoStore();
    const accountIds = s.accounts.filter((a) => a.connectionId === connectionId).map((a) => a.id);
    s.transactions = s.transactions.filter((t) => !accountIds.includes(t.accountId));
    s.accounts = s.accounts.filter((a) => a.connectionId !== connectionId);
    s.connections = s.connections.filter((c) => c.id !== connectionId);
    s.secrets.delete(connectionId);
    return;
  }
  const db = createSupabaseAdmin();
  // bank_accounts, bank_transactions and connection_secrets are removed by "on delete cascade"
  const { error } = await db.from("connections").delete().eq("id", connectionId).eq("company_id", companyId);
  if (error) throw new Error(error.message);
}

export async function upsertBankAccounts(companyId: string, connectionId: string, accounts: BankAccountInput[]) {
  const now = new Date().toISOString();
  if (isDemo) {
    const s = demoStore();
    for (const a of accounts) {
      const existing = s.accounts.find((x) => x.plaidAccountId === a.plaidAccountId);
      if (existing) Object.assign(existing, { ...a, updatedAt: now });
      else s.accounts.push({ id: crypto.randomUUID(), connectionId, includeInCash: a.type === "depository", updatedAt: now, ...a });
    }
    return;
  }
  const db = createSupabaseAdmin();
  for (const a of accounts) {
    const row = {
      company_id: companyId,
      connection_id: connectionId,
      plaid_account_id: a.plaidAccountId,
      name: a.name,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      current_cents: a.currentCents,
      available_cents: a.availableCents,
      updated_at: now,
    };
    const existing = await db.from("bank_accounts").select("id").eq("plaid_account_id", a.plaidAccountId).eq("company_id", companyId).maybeSingle();
    const res = existing.data
      ? await db.from("bank_accounts").update(row).eq("id", existing.data.id)
      : await db.from("bank_accounts").insert({ ...row, include_in_cash: a.type === "depository" });
    if (res.error) throw new Error(res.error.message);
  }
}

export async function applyTransactions(
  companyId: string,
  changes: { upsert: TransactionInput[]; remove: string[] },
) {
  if (isDemo) {
    const s = demoStore();
    s.transactions = s.transactions.filter((t) => !changes.remove.includes(t.plaidTransactionId));
    for (const t of changes.upsert) {
      const account = s.accounts.find((a) => a.plaidAccountId === t.plaidAccountId);
      if (!account) continue;
      const row = { id: crypto.randomUUID(), accountId: account.id, date: t.date, name: t.name, amountCents: t.amountCents, pending: t.pending, plaidTransactionId: t.plaidTransactionId };
      const i = s.transactions.findIndex((x) => x.plaidTransactionId === t.plaidTransactionId);
      if (i >= 0) s.transactions[i] = { ...row, id: s.transactions[i].id };
      else s.transactions.push(row);
    }
    return;
  }
  const db = createSupabaseAdmin();
  if (changes.remove.length) {
    await db.from("bank_transactions").delete().eq("company_id", companyId).in("plaid_transaction_id", changes.remove);
  }
  if (changes.upsert.length) {
    const { data: accounts } = await db.from("bank_accounts").select("id, plaid_account_id").eq("company_id", companyId);
    const byPlaid = new Map((accounts ?? []).map((a) => [a.plaid_account_id, a.id]));
    const rows = changes.upsert
      .filter((t) => byPlaid.has(t.plaidAccountId))
      .map((t) => ({
        company_id: companyId,
        account_id: byPlaid.get(t.plaidAccountId),
        plaid_transaction_id: t.plaidTransactionId,
        date: t.date,
        name: t.name,
        amount_cents: t.amountCents,
        pending: t.pending,
      }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("bank_transactions").upsert(rows.slice(i, i + 500), { onConflict: "plaid_transaction_id" });
      if (error) throw new Error(error.message);
    }
  }
}
