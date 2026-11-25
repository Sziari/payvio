import { AuthForm } from "../auth-form";
import { setNewPassword } from "../actions";

export default function ResetPasswordPage() {
  return (
    <AuthForm
      title="Choose a new password"
      subtitle="You'll be signed in right after."
      action={setNewPassword}
      submitLabel="Save password"
      fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 8 characters." }]}
    />
  );
}
