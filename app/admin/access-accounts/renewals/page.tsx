import AppShell from "@/components/layout/AppShell";
import AccountRenewalRequests from "@/components/admin/AccountRenewalRequests";

export default function AccountRenewalsPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">
          Account Renewal Requests
        </h1>

        <p className="mt-2 text-white/80">
          Review submitted account renewals, request
          corrections, approve updates, or deny renewal.
        </p>
      </div>

      <AccountRenewalRequests />
    </AppShell>
  );
}
