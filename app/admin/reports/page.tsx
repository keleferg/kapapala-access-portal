import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";

export default function ReportsPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Reports</h2>
        <span>
          View operational reports for account activity, access requests, gate
          usage, SMS delivery, and administrative actions.
        </span>
      </div>

      <div className="card-grid three">
        <Card title="Daily Access Summary">
          <p className="muted-text">Requests by date, gate, purpose, and status.</p>
          <button className="button secondary form-button" type="button">Open Report</button>
        </Card>
        <Card title="Gate Usage Report">
          <p className="muted-text">Wood Valley, Honanui, and ʻĀinapō use trends.</p>
          <button className="button secondary form-button" type="button">Open Report</button>
        </Card>
        <Card title="Account Status Report">
          <p className="muted-text">Active, pending, expired, suspended, and revoked accounts.</p>
          <button className="button secondary form-button" type="button">Open Report</button>
        </Card>
      </div>
    </AppShell>
  );
}
