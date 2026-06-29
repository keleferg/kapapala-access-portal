import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { communicationTemplates } from "../../lib/operationsConfig";

export default function CommunicationsPanel() {
  return (
    <Card title="Communications Center">
      <p className="muted-text">
        Centralizes SMS, email, broadcasts, templates, delivery logs, and failed-message retries.
      </p>
      <div className="template-list">
        {communicationTemplates.map((template) => (
          <div className="template-card" key={template.name}>
            <div className="template-top-row">
              <div>
                <strong>{template.name}</strong>
                <p>{template.trigger}</p>
              </div>
              <StatusBadge label={template.channel} tone="green" />
            </div>
            <div className="template-body-preview">{template.body}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
