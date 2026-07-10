import AppShell from "../../../components/layout/AppShell";
import DailyAccessNotificationPanel from "../../../components/operations/DailyAccessNotificationPanel";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";

export default function CommunicationsPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Operations</p>
        <h2>Communications Center</h2>
        <span>
          Send in-app notifications to users with approved access for a selected date and gate.
        </span>
      </div>

      <div className="card-grid four">
        <Card title="Audience">
          <div className="big-value">Daily</div>
          <StatusBadge label="Approved Users" tone="green" />
        </Card>

        <Card title="Delivery Type">
          <div className="big-value">In-App</div>
          <StatusBadge label="Phase 1" tone="green" />
        </Card>

        <Card title="Gate Filter">
          <div className="big-value">Yes</div>
          <StatusBadge label="Optional" tone="yellow" />
        </Card>

        <Card title="Push Alerts">
          <div className="big-value">Later</div>
          <StatusBadge label="Phase 2" tone="gray" />
        </Card>
      </div>

      <DailyAccessNotificationPanel />
    </AppShell>
  );
}