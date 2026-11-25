import { redirect } from "next/navigation";
import { loadContext } from "@/lib/data/context";
import { AuthForm } from "../auth-form";
import { createCompany } from "../actions";

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
