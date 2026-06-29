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

      <div className="card-grid four">
        <Card title="Account Requests">
          <div className="big-value">4</div>
          <StatusBadge label="Needs Review" tone="yellow" />
        </Card>
        <Card title="Daily Requests">
          <div className="big-value">18</div>
          <StatusBadge label="Today" tone="green" />
        </Card>
        <Card title="Approved Today">
          <div className="big-value">14</div>
          <StatusBadge label="SMS Sent" tone="green" />
        </Card>
        <Card title="Needs Attention">
          <div className="big-value">3</div>
          <StatusBadge label="Review" tone="red" />
        </Card>
      </div>

      <AdminOperationsTabs />

      <SmsDeliveryLog />
    </AppShell>
  );
}
