import AppShell from "../../../components/layout/AppShell";
import ConfigurationPanel from "../../../components/operations/ConfigurationPanel";
import Card from "../../../components/ui/Card";

export default function ConfigurationPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Configuration Management</h2>
        <span>
          Central place for values that should be editable without a code deployment.
        </span>
      </div>

      <Card title="Configuration Philosophy">
        <p className="muted-text">
          Gates, access purposes, organization names, notification timing, SMS templates, validity periods, and similar operational values should be managed as data. This prevents normal ranch policy updates from requiring software changes.
        </p>
      </Card>

      <ConfigurationPanel />
    </AppShell>
  );
}
