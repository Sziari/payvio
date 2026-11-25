import { brand } from "@/config/brand";
import { AuthForm } from "../auth-form";
import { signUp } from "../actions";

export default function SignupPage() {
  return (
    <AuthForm
      title={`Create your ${brand.name} account`}
      subtitle="It takes about a minute."
      action={signUp}
      submitLabel="Create account"
      fields={[
        { name: "email", label: "Work email", type: "email", autoComplete: "email" },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "new-password",
          hint: "At least 8 characters.",
        },
      ]}
      footer={{ text: "Already have an account?", href: "/login", link: "Sign in" }}
    />
  );
}
