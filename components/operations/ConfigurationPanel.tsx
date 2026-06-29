import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { configurationItems } from "../../lib/operationsConfig";

export default function ConfigurationPanel() {
  return (
    <Card title="Configuration Management">
      <p className="muted-text">
        System values that change over time should be editable by authorized administrators instead of hard-coded into the application.
      </p>
      <div className="configuration-table">
        <div>
          <strong>Group</strong>
          <strong>Item</strong>
          <strong>Current Value</strong>
          <strong>Status</strong>
        </div>
        {configurationItems.map((item) => (
          <div key={`${item.group}-${item.item}`}>
            <span>{item.group}</span>
            <span>{item.item}</span>
            <span>{item.value}</span>
            <StatusBadge label="Configurable" tone="green" />
          </div>
        ))}
      </div>
    </Card>
  );
}
