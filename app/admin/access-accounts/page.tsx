import AppShell from "../../../components/layout/AppShell";
import AccessAccountManagement from "../../../components/admin/AccessAccountManagement";

export default function AccessAccountsPage() {
  return (
    <AppShell>
      <div className="access-accounts-page">
        <div className="page-heading">
          <p>Administration</p>
          <h2>Access Account Management</h2>
          <span>
            Search, review, renew, suspend, and manage all approved and pending
            Kapāpala access accounts.
          </span>
        </div>

        <AccessAccountManagement />
      </div>
    </AppShell>
  );
}