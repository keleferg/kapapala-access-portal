import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { accessAccountWorkflow, dailyAccessWorkflow } from "../../lib/operationsConfig";

function WorkflowColumn({
  title,
  description,
  steps,
}: {
  title: string;
  description: string;
  steps: { key: string; label: string; description: string }[];
}) {
  return (
    <Card title={title}>
      <p className="muted-text">{description}</p>
      <div className="workflow-step-list">
        {steps.map((step, index) => (
          <div className="workflow-step-card" key={step.key}>
            <div className="workflow-step-number">{index + 1}</div>
            <div>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function WorkflowOverview() {
  return (
    <div className="operations-stack">
      <div className="operations-hero">
        <div>
          <p className="eyebrow">Version 2.2</p>
          <h2>Workflow Automation Engine</h2>
          <p>
            Defines the operational lifecycle for access accounts and daily access requests. Each step will become auditable, configurable, and eventually connected to Supabase, ClickSend, and email delivery.
          </p>
        </div>
        <StatusBadge label="Operational Design" tone="green" />
      </div>

      <div className="card-grid two">
        <WorkflowColumn
          title="Access Account Workflow"
          description="Replaces the first Microsoft Form and manual SharePoint review process."
          steps={accessAccountWorkflow}
        />
        <WorkflowColumn
          title="Daily Access Workflow"
          description="Replaces the daily gate code Microsoft Form and Power Automate validation flow."
          steps={dailyAccessWorkflow}
        />
      </div>
    </div>
  );
}
