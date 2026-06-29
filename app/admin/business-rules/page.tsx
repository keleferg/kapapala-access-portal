import AppShell from "../../../components/layout/AppShell";
import BusinessRulesPanel from "../../../components/operations/BusinessRulesPanel";
import ConfigurationPanel from "../../../components/operations/ConfigurationPanel";

export default function BusinessRulesPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Operations</p>
        <h2>Business Rules</h2>
        <span>
          Ranch policy, access requirements, automatic approval rules, and conditional request logic.
        </span>
      </div>

      <BusinessRulesPanel />
      <ConfigurationPanel />
    </AppShell>
  );
}
