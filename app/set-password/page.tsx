import AppShell from "../../components/layout/AppShell";
import SetPasswordForm from "../../components/auth/SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Access Portal</p>
        <h2>Set Password</h2>
        <span>Create or update your portal password.</span>
      </div>

      <SetPasswordForm />
    </AppShell>
  );
}