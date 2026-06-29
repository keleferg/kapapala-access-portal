import AppShell from "../../../components/layout/AppShell";
import PendingReviewQueue from "../../../components/admin/PendingReviewQueue";

export default function AdminReviewsPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Access Account Request Queue</h2>
        <span>
          Review uploaded identification, approve applicants, and prepare Access
          ID issuance.
        </span>
      </div>

      <PendingReviewQueue />
    </AppShell>
  );
}
