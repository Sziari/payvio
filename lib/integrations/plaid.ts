import "server-only";
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from "plaid/legacy";
import { brand } from "@/config/brand";
import { toCents } from "@/lib/money";
import {
  applyTransactions,
  getSecret,
  listConnectionsFor,
  markConnection,
  saveConnection,
  updateSecret,
  upsertBankAccounts,
  type TransactionInput,
} from "./store";

// Plaid: connect a bank once with Plaid Link, then pull balances and transactions.
// We never see bank usernames or passwords; Plaid gives us an access token, stored encrypted.

type PlaidSecret = { accessToken: string };

export function plaidConfigured() {
  return !!process.env.PLAID_CLIENT_ID && !!process.env.PLAID_SECRET;
}

function client() {
  const env = process.env.PLAID_ENV === "production" ? "production" : "sandbox";
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: { "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!, "PLAID-SECRET": process.env.PLAID_SECRET! },
      },
    }),
  );
}

/** Short message from a Plaid API error */
export function plaidError(err: unknown): string {
  const data = (err as { response?: { data?: { error_code?: string; error_message?: string; display_message?: string } } })
    ?.response?.data;
  if (data?.error_code === "ITEM_LOGIN_REQUIRED") return "The bank needs you to sign in again. Press Reconnect.";
  return data?.display_message || data?.error_message || (err instanceof Error ? err.message : "Plaid request failed");
}

export async function createLinkToken(userId: string, accessTokenForUpdate?: string) {
  const res = await client().linkTokenCreate({
    user: { client_user_id: userId },
    client_name: brand.name,
    language: "en",
    country_codes: [CountryCode.Us],
    ...(accessTokenForUpdate
      ? { access_token: accessTokenForUpdate } // "update mode" to fix a broken login
      : { products: [Products.Transactions], transactions: { days_requested: 90 } }),
  });
  return res.data.link_token;
}

export async function exchangePublicToken(companyId: string, publicToken: string, institutionName: string | null) {
  const res = await client().itemPublicTokenExchange({ public_token: publicToken });
  const connectionId = await saveConnection(companyId, "plaid", res.data.item_id, institutionName, {
    accessToken: res.data.access_token,
  } satisfies PlaidSecret);
  await syncPlaidConnection(companyId, connectionId);
  return connectionId;
}

/** Pull balances and new transactions for one bank connection. */
export async function syncPlaidConnection(companyId: string, connectionId: string) {
  const { secret, cursor: startCursor } = await getSecret<PlaidSecret>(companyId, connectionId);
  const api = client();
  try {
    const accounts = await api.accountsGet({ access_token: secret.accessToken });
    await upsertBankAccounts(
      companyId,
      connectionId,
      accounts.data.accounts.map((a) => ({
        plaidAccountId: a.account_id,
        name: a.official_name || a.name,
        mask: a.mask ?? null,
        type: a.type ?? null,
        subtype: a.subtype ?? null,
        currentCents: toCents(a.balances.current ?? null),
        availableCents: toCents(a.balances.available ?? null),
      })),
    );

    let cursor = startCursor ?? undefined;
    const upsert: TransactionInput[] = [];
    const remove: string[] = [];
    for (let page = 0; page < 50; page++) {
      const r = await api.transactionsSync({ access_token: secret.accessToken, cursor, count: 500 });
      for (const t of [...r.data.added, ...r.data.modified]) {
        upsert.push({
          plaidTransactionId: t.transaction_id,
          plaidAccountId: t.account_id,
          date: t.date,
          name: (t.merchant_name || t.name || "Transaction").slice(0, 200),
          amountCents: toCents(t.amount) ?? 0,
          pending: t.pending,
        });
      }
      remove.push(...r.data.removed.map((t) => t.transaction_id));
      cursor = r.data.next_cursor;
      if (!r.data.has_more) break;
    }
    await applyTransactions(companyId, { upsert, remove });
    await updateSecret(companyId, connectionId, { cursor: cursor ?? null });
    await markConnection(companyId, connectionId, { status: "active", lastSyncedAt: new Date().toISOString(), lastError: null });
  } catch (err) {
    const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
    await markConnection(companyId, connectionId, {
      status: code === "ITEM_LOGIN_REQUIRED" ? "needs_reauth" : "error",
      lastError: plaidError(err),
    });
    throw new Error(plaidError(err));
  }
}

export async function syncAllPlaid(companyId: string) {
  const errors: string[] = [];
  for (const c of await listConnectionsFor(companyId, "plaid")) {
    try {
      await syncPlaidConnection(companyId, c.id);
    } catch (e) {
      errors.push(`${c.displayName ?? "Bank"}: ${e instanceof Error ? e.message : "sync failed"}`);
    }
  }
  return errors;
}

export async function removePlaidItem(companyId: string, connectionId: string) {
  try {
    const { secret } = await getSecret<PlaidSecret>(companyId, connectionId);
    await client().itemRemove({ access_token: secret.accessToken });
  } catch {
    // Already removed at Plaid; still delete our copy.
  }
}

export async function accessTokenFor(companyId: string, connectionId: string) {
  return (await getSecret<PlaidSecret>(companyId, connectionId)).secret.accessToken;
}
