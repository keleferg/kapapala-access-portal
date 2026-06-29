import AppShell from "../../components/layout/AppShell";
import AccessAccountWizard from "../../components/account/AccessAccountWizard";

export default function ApplyPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Access Account</p>
        <h2>Apply for an Access Account</h2>
        <span>
          Create your Kapāpala Ranch access account, upload your ID, save
          vehicles, and agree to the public access rules.
        </span>
      </div>

      <AccessAccountWizard />
    </AppShell>
  );
}
