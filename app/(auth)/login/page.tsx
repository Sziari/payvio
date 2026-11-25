import { brand } from "@/config/brand";
import { AuthForm } from "../auth-form";
import { signIn } from "../actions";

export default function LoginPage() {
  return (
    <AuthForm
      title={`Sign in to ${brand.name}`}
      subtitle="Welcome back."
      action={signIn}
      submitLabel="Sign in"
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      footer={{ text: "New here?", href: "/signup", link: "Create an account" }}
      extraLink={{ href: "/forgot-password", label: "Forgot your password?" }}
    />
  );
}
