import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";

const logRows = [
  { time: "Today 8:42 AM", actor: "Admin Demo", action: "Approved daily request", target: "KAP-2026-00482", status: "Complete", tone: "green" as const },
  { time: "Today 8:39 AM", actor: "System", action: "SMS delivered", target: "Wood Valley / 4317", status: "Sent", tone: "green" as const },
  { time: "Today 8:12 AM", actor: "Applicant", action: "Submitted access account request", target: "Kawika Demo", status: "Pending", tone: "yellow" as const },
  { time: "Yesterday 4:31 PM", actor: "Admin Demo", action: "Placed request on hold", target: "Research Team", status: "Review", tone: "yellow" as const },
];

export default function SystemLogPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>System Log</h2>
        <span>
          Review administrative actions, SMS events, approvals, account changes,
          and system-generated activity.
        </span>
      </div>

      <Card title="Recent System Activity">
        <div className="system-log-table">
          <div>
            <span>Time</span>
            <span>Actor</span>
            <span>Action</span>
            <span>Target</span>
            <span>Status</span>
          </div>
          {logRows.map((row) => (
            <div key={`${row.time}-${row.action}`}>
              <strong>{row.time}</strong>
              <span>{row.actor}</span>
              <span>{row.action}</span>
              <span>{row.target}</span>
              <StatusBadge label={row.status} tone={row.tone} />
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
