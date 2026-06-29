import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

export default function AccessCard() {
  return (
    <Card title="My Access ID" subtitle="Account status">
      <div className="big-value">KP-001245</div>
      <StatusBadge label="Active" tone="green" />
      <p className="muted-text">Expires June 30, 2028</p>
    </Card>
  );
}
