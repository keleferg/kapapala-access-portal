import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";

export default function AdminPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Admin Dashboard</h2>
        <span>Review access accounts, requests, gate combinations, and SMS delivery.</span>
      </div>

      <div className="card-grid four">
        <Card title="Pending ID Reviews"><div className="big-value">8</div></Card>
        <Card title="Today&apos;s Requests"><div className="big-value">31</div></Card>
        <Card title="Approved Today"><div className="big-value">24</div></Card>
        <Card title="SMS Failed"><div className="big-value">1</div></Card>
      </div>

      <Card title="Recent Access Requests">
        <div className="table-like">
          <div><strong>Name</strong><strong>Gate</strong><strong>Date</strong><strong>Status</strong></div>
          <div><span>Demo User</span><span>Wood Valley</span><span>July 4</span><StatusBadge label="Approved" tone="green" /></div>
          <div><span>Demo User</span><span>ʻĀinapō</span><span>July 5</span><StatusBadge label="Review" tone="yellow" /></div>
        </div>
      </Card>
    </AppShell>
  );
}
