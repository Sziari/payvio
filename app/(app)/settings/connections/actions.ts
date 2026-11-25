"use server";

import { revalidatePath } from "next/cache";
import { costTypes } from "@/config/workflows";
import { requireContext } from "@/lib/data/context";
import {
  accessTokenFor,
  createLinkToken,
  exchangePublicToken,
  plaidConfigured,
  plaidError,
  removePlaidItem,
  syncAllPlaid,
} from "@/lib/integrations/plaid";
import { importVendors, pushBills, quickbooksConfigured, revokeQuickBooks } from "@/lib/integrations/quickbooks";
import { deleteConnection, listConnectionsFor } from "@/lib/integrations/store";

export type Result = { ok: true; message?: string; linkToken?: string } | { ok: false; error: string };

async function admin() {
  const ctx = await requireContext();
  if (!["owner", "office_manager"].includes(ctx.user.role)) {
    throw new Error("Only the owner or office manager can change connections.");
  }
  return ctx;
}

function done() {
  revalidatePath("/settings/connections");
  revalidatePath("/dashboard");
  revalidatePath("/forecast");
}

async function safely(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------- Bank (Plaid) ----------

export async function getPlaidLinkToken(reconnectId?: string): Promise<Result> {
  return safely(async () => {
    const { repo, user } = await admin();
    if (!plaidConfigured()) return { ok: false, error: "Plaid keys are not set yet." };
    try {
      const token = await createLinkToken(
        user.id,
        reconnectId ? await accessTokenFor(repo.companyId, reconnectId) : undefined,
      );
      return { ok: true, linkToken: token };
    } catch (e) {
      return { ok: false, error: plaidError(e) };
    }
  });
}

export async function finishPlaidLink(publicToken: string, institutionName: string | null): Promise<Result> {
  return safely(async () => {
    const { repo } = await admin();
    if (typeof publicToken !== "string" || publicToken.length > 500) return { ok: false, error: "Bad token" };
    await exchangePublicToken(repo.companyId, publicToken, institutionName?.slice(0, 100) ?? null);
    done();
    return { ok: true, message: "Bank connected. Balances and the last 90 days of transactions are coming in." };
  });
}

export async function syncBank(): Promise<Result> {
  return safely(async () => {
    const { repo } = await requireContext();
    const errors = await syncAllPlaid(repo.companyId);
    done();
    return errors.length ? { ok: false, error: errors.join(" ") } : { ok: true, message: "Bank balances updated." };
  });
}

export async function disconnect(connectionId: string): Promise<Result> {
  return safely(async () => {
    const { repo } = await admin();
    const plaid = await listConnectionsFor(repo.companyId, "plaid");
    const qbo = await listConnectionsFor(repo.companyId, "quickbooks");
    if (plaid.some((c) => c.id === connectionId)) await removePlaidItem(repo.companyId, connectionId);
    else if (qbo.some((c) => c.id === connectionId)) await revokeQuickBooks(repo.companyId, connectionId);
    else return { ok: false, error: "Connection not found." };
    await deleteConnection(repo.companyId, connectionId);
    done();
    return { ok: true, message: "Disconnected." };
  });
}

export async function setAccountIncluded(accountId: string, include: boolean): Promise<Result> {
  return safely(async () => {
    const { repo } = await requireContext();
    await repo.setAccountIncluded(accountId, include);
    done();
    return { ok: true };
  });
}

// ---------- QuickBooks ----------

export async function qboImportVendors(): Promise<Result> {
  return safely(async () => {
    const { repo } = await admin();
    if (!quickbooksConfigured()) return { ok: false, error: "QuickBooks keys are not set yet." };
    const r = await importVendors(repo);
    revalidatePath("/vendors");
    done();
    return { ok: true, message: `Suppliers imported: ${r.created} new, ${r.linked} matched to ones you already had.` };
  });
}

export async function qboPushBills(): Promise<Result> {
  return safely(async () => {
    const { repo } = await admin();
    const r = await pushBills(repo);
    revalidatePath("/inbox", "layout");
    done();
    if (r.errors.length) {
      return { ok: false, error: `Sent ${r.sent}. Not sent: ${r.errors.slice(0, 5).join("; ")}${r.errors.length > 5 ? "..." : ""}` };
    }
    return { ok: true, message: r.sent ? `Sent ${r.sent} bill${r.sent > 1 ? "s" : ""} to QuickBooks.` : "Nothing new to send." };
  });
}

export async function saveAccountMapping(form: FormData): Promise<Result> {
  return safely(async () => {
    const { repo } = await admin();
    const map: Record<string, string> = {};
    for (const key of ["default", ...costTypes]) {
      const v = String(form.get(`acct:${key}`) ?? "").trim();
      if (v && /^\d{1,20}$/.test(v)) map[key] = v;
    }
    await repo.updateCompany({ qboExpenseAccounts: map });
    done();
    return { ok: true, message: "Saved." };
  });
}
