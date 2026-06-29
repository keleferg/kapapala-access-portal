import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";

const gates = ["Wood Valley", "Honanui", "ʻĀinapō"];

export default function GatesPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Gate Combinations</h2>
        <span>Manage gate status and daily combinations.</span>
      </div>

      <div className="card-grid three">
        {gates.map((gate) => (
          <Card key={gate} title={gate}>
            <StatusBadge label={gate === "ʻĀinapō" ? "Restricted" : "Open"} tone={gate === "ʻĀinapō" ? "yellow" : "green"} />
            <form className="single-column-form">
              <label>Date<input type="date" /></label>
              <label>Combination<input placeholder="Enter combination" /></label>
              <label>Notes<input placeholder="Optional gate notice" /></label>
            </form>
            <button className="button primary form-button">Save Gate Info</button>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
