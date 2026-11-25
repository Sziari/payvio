"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { costTypes, type CostType } from "@/config/workflows";
import { requireContext } from "@/lib/data/context";
import { toCents } from "@/lib/money";

export type JobFormState = { error?: string } | undefined;

export async function saveJob(_prev: JobFormState, form: FormData): Promise<JobFormState> {
  const { repo } = await requireContext();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Give the job a name." };

  const contract = toCents(String(form.get("contract") ?? ""));
  if (contract !== null && contract < 0) return { error: "Contract amount can't be negative." };

  const budgets: Partial<Record<CostType, number>> = {};
  for (const t of costTypes) {
    const v = toCents(String(form.get(`budget:${t}`) ?? ""));
    if (v !== null && v !== 0) budgets[t] = v;
  }

  const text = (k: string) => String(form.get(k) ?? "").trim() || null;
  const input = {
    name,
    jobNumber: text("jobNumber"),
    address: text("address"),
    city: text("city"),
    customer: text("customer"),
    contractCents: contract ?? 0,
    budgets,
  };

  let jobId = id;
  if (id) await repo.updateJob(id, input);
  else jobId = (await repo.createJob(input)).id;

  revalidatePath("/jobs");
  redirect(`/jobs/${jobId}`);
}

export async function setJobArchived(id: string, archived: boolean) {
  const { repo } = await requireContext();
  await repo.updateJob(id, { archived });
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
}
