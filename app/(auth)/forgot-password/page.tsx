import { AuthForm } from "../auth-form";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  return (
    <AuthForm
      title="Reset your password"
      subtitle="We'll email you a link."
      action={requestPasswordReset}
      submitLabel="Send reset link"
      fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
      footer={{ text: "Remembered it?", href: "/login", link: "Sign in" }}
    />
  );
}
