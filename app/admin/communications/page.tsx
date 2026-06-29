import AppShell from "../../../components/layout/AppShell";
import CommunicationsPanel from "../../../components/operations/CommunicationsPanel";
import NotificationsPanel from "../../../components/operations/NotificationsPanel";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";

export default function CommunicationsPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Operations</p>
        <h2>Communications Center</h2>
        <span>
          Manage SMS templates, email templates, broadcasts, delivery history, and failed-message retry workflows.
        </span>
      </div>

      <div className="card-grid four">
        <Card title="SMS Today"><div className="big-value">16</div><StatusBadge label="Sent" tone="green" /></Card>
        <Card title="Failed SMS"><div className="big-value">1</div><StatusBadge label="Retry Needed" tone="red" /></Card>
        <Card title="Templates"><div className="big-value">4</div><StatusBadge label="Draft" tone="yellow" /></Card>
        <Card title="Broadcasts"><div className="big-value">0</div><StatusBadge label="None Active" tone="gray" /></Card>
      </div>

      <CommunicationsPanel />
      <NotificationsPanel />
    </AppShell>
  );
}
