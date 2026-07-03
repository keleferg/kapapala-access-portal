import AppShell from "../../../components/layout/AppShell";
import DailyAccessRequestQueue from "../../../components/admin/DailyAccessRequestQueue";

export default function AdminRequestsPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>

        <h2>Daily Access Requests</h2>

        <span>
          Review incoming requests, approve or deny access, assign gate
          combinations, and monitor request status.
        </span>
      </div>

      <DailyAccessRequestQueue />
    </AppShell>
  );
}