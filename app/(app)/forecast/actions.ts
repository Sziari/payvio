"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/data/context";
import { addDays, isValidISODate } from "@/lib/dates";
import { toCents } from "@/lib/money";
import type { RecurringCost } from "@/lib/types";

export type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/forecast");
  revalidatePath("/dashboard");
}

export async function savePayment(form: FormData): Promise<Result> {
  const { repo } = await requireContext();
  const id = String(form.get("id") ?? "");
  const customer = String(form.get("customer") ?? "").trim();
  const amount = toCents(String(form.get("amount") ?? ""));
  const date = String(form.get("expectedDate") ?? "");
  const jobId = String(form.get("jobId") ?? "") || null;
  const note = String(form.get("note") ?? "").trim() || null;
  if (!customer) return { ok: false, error: "Who is paying?" };
  if (amount === null || amount <= 0) return { ok: false, error: "Enter the amount you expect." };
  if (!isValidISODate(date)) return { ok: false, error: "Pick the date you expect it." };
  const input = { customer, amountCents: amount, expectedDate: date, jobId, note };
  if (id) await repo.updatePayment(id, input);
  else await repo.createPayment({ ...input, received: false });
  refresh();
  return { ok: true };
}

export async function setPaymentReceived(id: string, received: boolean) {
  const { repo } = await requireContext();
  await repo.updatePayment(id, { received });
  refresh();
}

export async function deletePayment(id: string) {
  const { repo } = await requireContext();
  await repo.deletePayment(id);
  refresh();
}

const CATEGORIES: RecurringCost["category"][] = ["payroll", "loan", "lease", "card", "other"];
const FREQUENCIES: RecurringCost["frequency"][] = ["weekly", "biweekly", "monthly"];

export async function saveRecurring(form: FormData): Promise<Result> {
  const { repo } = await requireContext();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const amount = toCents(String(form.get("amount") ?? ""));
  const category = String(form.get("category")) as RecurringCost["category"];
  const frequency = String(form.get("frequency")) as RecurringCost["frequency"];
  const nextDate = String(form.get("nextDate") ?? "");
  if (!name) return { ok: false, error: "Name this cost (for example: Weekly payroll)." };
  if (amount === null || amount <= 0) return { ok: false, error: "Enter the amount." };
  if (!CATEGORIES.includes(category) || !FREQUENCIES.includes(frequency)) return { ok: false, error: "Pick a type and how often." };
  if (!isValidISODate(nextDate)) return { ok: false, error: "Pick the next date it's paid." };
  const input = { name, amountCents: amount, category, frequency, nextDate, active: true };
  if (id) await repo.updateRecurring(id, input);
  else await repo.createRecurring(input);
  refresh();
  return { ok: true };
}

export async function deleteRecurring(id: string) {
  const { repo } = await requireContext();
  await repo.deleteRecurring(id);
  refresh();
}

/** Save what-if moves: each payment's new date = start of the week it was dragged to (+ same weekday). */
export async function applyMoves(moves: { id: string; weekStart: string }[]): Promise<Result> {
  const { repo } = await requireContext();
  const payments = await repo.listPayments();
  for (const m of moves) {
    const p = payments.find((x) => x.id === m.id);
    if (!p || !isValidISODate(m.weekStart)) continue;
    const dow = (new Date(p.expectedDate + "T00:00:00Z").getUTCDay() + 6) % 7; // Mon=0
    await repo.updatePayment(p.id, { expectedDate: addDays(m.weekStart, Math.min(dow, 4)) });
  }
  refresh();
  return { ok: true };
}

export async function saveCashSettings(form: FormData): Promise<Result> {
  const { repo } = await requireContext();
  const starting = toCents(String(form.get("startingCash") ?? ""));
  const min = toCents(String(form.get("minCash") ?? ""));
  if (starting === null) return { ok: false, error: "Enter today's cash balance." };
  await repo.updateCompany({ startingCashCents: starting, minCashCents: Math.max(0, min ?? 0) });
  refresh();
  revalidatePath("/settings");
  return { ok: true };
}
