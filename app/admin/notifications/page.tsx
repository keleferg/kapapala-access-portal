import AppShell from "../../../components/layout/AppShell";
import NotificationsPanel from "../../../components/operations/NotificationsPanel";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";

export default function NotificationsPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Operations</p>
        <h2>Notifications</h2>
        <span>
          Proactive alerts for administrators and users, including expirations, delivery failures, closures, and stalled reviews.
        </span>
      </div>

      <div className="card-grid three">
        <Card title="Admin Alerts"><div className="big-value">3</div><StatusBadge label="Needs Attention" tone="yellow" /></Card>
        <Card title="User Reminders"><div className="big-value">12</div><StatusBadge label="Scheduled" tone="green" /></Card>
        <Card title="Emergency Notices"><div className="big-value">0</div><StatusBadge label="Inactive" tone="gray" /></Card>
      </div>

      <NotificationsPanel />
    </AppShell>
  );
}
