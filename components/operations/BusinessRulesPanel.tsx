import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { defaultBusinessRules } from "../../lib/operationsConfig";

export default function BusinessRulesPanel() {
  return (
    <Card title="Business Rules">
      <p className="muted-text">
        These rules will move ranch policy out of code and into administrator-controlled configuration.
      </p>
      <div className="business-rule-list">
        {defaultBusinessRules.map((rule) => (
          <div className="business-rule-card" key={rule.name}>
            <div>
              <div className="rule-card-header">
                <strong>{rule.name}</strong>
                <StatusBadge label={rule.category} tone="gray" />
              </div>
              <p>{rule.effect}</p>
            </div>
            <div className="rule-value-box">
              <span>Current Rule</span>
              <strong>{rule.currentValue}</strong>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
