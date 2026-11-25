import { redirect } from "next/navigation";
import { loadContext } from "@/lib/data/context";
import { AuthForm } from "../auth-form";
import { createCompany } from "../actions";

// Always render fresh: every page shows the signed-in company's live data.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await loadContext();
  if (!ctx.user) redirect("/login");
  if (ctx.repo) redirect("/dashboard");
  return (
    <AuthForm
      title="What's your company called?"
      subtitle="You can add your address, jobs and team later."
      action={createCompany}
      submitLabel="Continue"
      fields={[{ name: "name", label: "Company name", autoComplete: "organization" }]}
    />
  );
}
