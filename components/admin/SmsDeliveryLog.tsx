import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

const logs = [
  { name: "Kele Fergerstrom", phone: "••• ••• 1234", gate: "Wood Valley", time: "8:04 AM", status: "Delivered", tone: "green" as const },
  { name: "Demo Hunter", phone: "••• ••• 4410", gate: "Honanui", time: "8:07 AM", status: "Delivered", tone: "green" as const },
  { name: "Research Team", phone: "••• ••• 9088", gate: "ʻĀinapō", time: "Pending", status: "Not Sent", tone: "yellow" as const },
];

export default function SmsDeliveryLog() {
  return (
    <Card title="SMS Delivery Log">
      <div className="table-like sms-table">
        <div>
          <strong>User</strong>
          <strong>Phone</strong>
          <strong>Gate</strong>
          <strong>Time</strong>
          <strong>Status</strong>
        </div>
        {logs.map((log) => (
          <div key={`${log.name}-${log.gate}`}>
            <span>{log.name}</span>
            <span>{log.phone}</span>
            <span>{log.gate}</span>
            <span>{log.time}</span>
            <StatusBadge label={log.status} tone={log.tone} />
          </div>
        ))}
      </div>
    </Card>
  );
}
