import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";

export default function ForestReserveAccessPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Information</p>
        <h2>Forest Reserve Access</h2>
        <span>
          View Kapāpala Ranch forest reserve access information, gate procedures,
          rules, and safety guidance.
        </span>
      </div>

      <Card title="Forest Reserve Access">
        <p className="muted-text">
          Forest reserve access information is now maintained on the Kapāpala
          Ranch website.
        </p>

        <div className="quick-action-button-grid">
          <a
            className="button primary"
            href="https://kapapalaranch.com/forest-reserve-access"
            target="_blank"
            rel="noopener noreferrer"
          >
            Forest Reserve Access
          </a>
        </div>
      </Card>
    </AppShell>
  );
}