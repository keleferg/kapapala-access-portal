import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import AdminOperationsTabs from "../../components/admin/AdminOperationsTabs";
import LiveActivityBar from "../../components/admin/LiveActivityBar";
import SmsDeliveryLog from "../../components/admin/SmsDeliveryLog";

export default function AdminPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Admin Operations Center</h2>
        <span>
          Monitor live activity, review access account requests, approve daily
          access requests, and manage gate combinations from one dashboard.
        </span>
      </div>

      <LiveActivityBar />

      <AdminOperationsTabs />
      
    </AppShell>
  );
}
