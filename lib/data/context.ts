import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isDemo } from "@/lib/env";
import { DEMO_USER, DemoRepo } from "@/lib/data/demo";
import { SupabaseRepo } from "@/lib/data/supabase";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Repo, SessionUser } from "@/lib/data/repo";

export type AppContext = { repo: Repo; user: SessionUser };

/**
 * The signed-in user and their company's data.
 * Returns null (instead of redirecting) when not signed in or no company yet.
 */
export const loadContext = cache(async (): Promise<
  AppContext | { repo: null; user: { id: string; email: string | null } | null }
> => {
  if (isDemo) return { repo: new DemoRepo(), user: DEMO_USER };

  const db = await createSupabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { repo: null, user: null };

  const { data: membership } = await db
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!membership) return { repo: null, user: { id: user.id, email: user.email ?? null } };

  return {
    repo: new SupabaseRepo(db, membership.company_id),
    user: { id: user.id, email: user.email ?? null, role: membership.role },
  };
});

/** For pages and server actions: sends the user to sign in or set up a company if needed. */
export async function requireContext(): Promise<AppContext> {
  const ctx = await loadContext();
  if (!ctx.user) redirect("/login");
  if (!ctx.repo) redirect("/onboarding");
  return ctx as AppContext;
}
