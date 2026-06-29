import AppShell from "../../../components/layout/AppShell";
import DailyAccessQueue from "../../../components/admin/DailyAccessQueue";
import SmsDeliveryLog from "../../../components/admin/SmsDeliveryLog";

export default function AdminRequestsPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Daily Access Requests</h2>
        <span>
          Review access requests, approve valid requests, and confirm SMS delivery.
        </span>
      </div>

      <DailyAccessQueue />
      <SmsDeliveryLog />
    </AppShell>
  );
}
