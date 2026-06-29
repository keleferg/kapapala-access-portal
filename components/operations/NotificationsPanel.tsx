import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { notificationRules } from "../../lib/operationsConfig";

function priorityTone(priority: string): "green" | "yellow" | "red" | "gray" {
  if (priority === "High") return "red";
  if (priority === "Medium") return "yellow";
  return "gray";
}

export default function NotificationsPanel() {
  return (
    <Card title="Notification Framework">
      <p className="muted-text">
        Makes the system proactive by surfacing work, failures, expirations, and access advisories before they become problems.
      </p>
      <div className="notification-rule-list">
        {notificationRules.map((rule) => (
          <div className="notification-rule-card" key={rule.name}>
            <div>
              <strong>{rule.name}</strong>
              <p>{rule.audience} • {rule.delivery}</p>
            </div>
            <StatusBadge label={rule.priority} tone={priorityTone(rule.priority)} />
          </div>
        ))}
      </div>
    </Card>
  );
}
