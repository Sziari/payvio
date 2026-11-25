"use server";

import { redirect } from "next/navigation";
import { appUrl, isDemo } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";
import { loadContext } from "@/lib/data/context";

export type FormState = { error?: string; message?: string } | undefined;

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  if (isDemo) redirect("/dashboard");
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const db = await createSupabaseServer();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { error: "That email and password don't match. Try again or reset your password." };
  redirect("/dashboard");
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  if (isDemo) redirect("/dashboard");
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || password.length < 8) return { error: "Enter your email and a password of at least 8 characters." };
  const db = await createSupabaseServer();
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${appUrl()}/auth/callback` },
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: "Check your email for a link to confirm your account, then sign in." };
  redirect("/onboarding");
}

export async function signOut() {
  if (isDemo) return;
  const db = await createSupabaseServer();
  await db.auth.signOut();
  redirect("/login");
}

export async function createCompany(_prev: FormState, form: FormData): Promise<FormState> {
  if (isDemo) redirect("/dashboard");
  const ctx = await loadContext();
  if (!ctx.user) redirect("/login");
  if (ctx.repo) redirect("/dashboard");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Enter your company name." };
  const db = await createSupabaseServer();
  const { error } = await db.rpc("create_company", { company_name: name });
  if (error) return { error: error.message };
  redirect("/dashboard?welcome=1");
}
