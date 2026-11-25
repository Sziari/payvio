"use server";

import { revalidatePath } from "next/cache";
import { roles, type Role } from "@/config/workflows";
import { requireContext } from "@/lib/data/context";
import { buildSampleData } from "@/lib/data/sample";
import { appUrl } from "@/lib/env";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";

export type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function saveCompanyProfile(form: FormData): Promise<Result> {
  const { repo, user } = await requireContext();
  if (!["owner", "office_manager"].includes(user.role)) return { ok: false, error: "Only the owner or office manager can edit this." };
  const text = (k: string) => String(form.get(k) ?? "").trim().slice(0, 200) || null;
  const name = text("name");
  if (!name) return { ok: false, error: "Company name can't be blank." };
  await repo.updateCompany({ name, address: text("address"), city: text("city"), state: text("state"), phone: text("phone") });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

/** Adds the sample jobs, invoices, payments and recurring costs to a live company (for trying things out). */
export async function loadSampleData(): Promise<Result> {
  const { repo, user } = await requireContext();
  if (repo.mode === "demo") return { ok: false, error: "Demo mode already shows sample data." };
  if (user.role !== "owner") return { ok: false, error: "Only the owner can load sample data." };
  if ((await repo.listJobs()).length > 0) {
    return { ok: false, error: "Sample data can only be loaded into an empty company, so it never mixes with real jobs." };
  }
  const s = buildSampleData();
  const jobIds = new Map<string, string>();
  for (const j of s.jobs) {
    const { id, createdAt: _c, ...rest } = j;
    void _c;
    jobIds.set(id, (await repo.createJob(rest)).id);
  }
  for (const inv of s.invoices) {
    const { id: _id, createdAt: _c, ...rest } = inv;
    void _id; void _c;
    const vendor = rest.vendorName ? await repo.ensureVendor(rest.vendorName) : null;
    await repo.createInvoice({
      ...rest,
      vendorId: vendor?.id ?? null,
      jobId: rest.jobId ? (jobIds.get(rest.jobId) ?? null) : null,
      suggestedJobId: rest.suggestedJobId ? (jobIds.get(rest.suggestedJobId) ?? null) : null,
      approvals: rest.approvals.map((a) => ({ ...a, userId: user.id })),
    });
  }
  for (const p of s.payments) {
    const { id: _id, ...rest } = p;
    void _id;
    await repo.createPayment({ ...rest, jobId: rest.jobId ? (jobIds.get(rest.jobId) ?? null) : null });
  }
  for (const r of s.recurring) {
    const { id: _id, ...rest } = r;
    void _id;
    await repo.createRecurring(rest);
  }
  await repo.updateCompany({ startingCashCents: s.company.startingCashCents, minCashCents: s.company.minCashCents });
  revalidatePath("/", "layout");
  return { ok: true, message: "Sample data loaded. Look at the Dixon Warehouse Slab job: it should total $2,145.60." };
}

/** Owner adds a teammate. They get an email to set their password. */
export async function inviteTeammate(form: FormData): Promise<Result> {
  const { repo, user } = await requireContext();
  if (repo.mode === "demo") return { ok: false, error: "Invites work once Supabase is connected." };
  if (user.role !== "owner") return { ok: false, error: "Only the owner can add teammates." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "") as Role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (!roles.includes(role)) return { ok: false, error: "Pick a role." };

  const admin = createSupabaseAdmin();
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, password: crypto.randomUUID() + "Aa1!" });
  let userId = created.data.user?.id;
  if (!userId) {
    // Already has an account: find it
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) return { ok: false, error: created.error?.message ?? "Couldn't create that user." };
  }
  const { error } = await admin
    .from("company_members")
    .upsert({ company_id: repo.companyId, user_id: userId, email, role }, { onConflict: "company_id,user_id" });
  if (error) return { ok: false, error: error.message };

  if (created.data.user) {
    const db = await createSupabaseServer();
    await db.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl()}/auth/callback?next=/reset-password` });
  }
  revalidatePath("/settings");
  return {
    ok: true,
    message: created.data.user
      ? `Added. ${email} will get an email to set a password.`
      : `Added. ${email} already had an account and can sign in now.`,
  };
}

export async function changeRole(userId: string, role: Role): Promise<Result> {
  const { repo, user } = await requireContext();
  if (user.role !== "owner") return { ok: false, error: "Only the owner can change roles." };
  if (userId === user.id) return { ok: false, error: "You can't change your own role." };
  if (!roles.includes(role)) return { ok: false, error: "Unknown role." };
  const db = await createSupabaseServer();
  const { error } = await db.from("company_members").update({ role }).eq("company_id", repo.companyId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeTeammate(userId: string): Promise<Result> {
  const { repo, user } = await requireContext();
  if (user.role !== "owner") return { ok: false, error: "Only the owner can remove teammates." };
  if (userId === user.id) return { ok: false, error: "You can't remove yourself." };
  const db = await createSupabaseServer();
  const { error } = await db.from("company_members").delete().eq("company_id", repo.companyId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
