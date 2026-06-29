import AppShell from "../../../components/layout/AppShell";
import WorkflowOverview from "../../../components/operations/WorkflowOverview";
import BusinessRulesPanel from "../../../components/operations/BusinessRulesPanel";
import NotificationsPanel from "../../../components/operations/NotificationsPanel";

export default function WorkflowsPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Workflow Engine</h2>
        <span>
          Operational lifecycle design for access accounts, daily requests, notifications, and audit events.
        </span>
      </div>

      <WorkflowOverview />
      <BusinessRulesPanel />
      <NotificationsPanel />
    </AppShell>
  );
}
