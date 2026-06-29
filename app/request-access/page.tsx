import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";

export default function RequestAccessPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Daily Access</p>
        <h2>Request Access</h2>
        <span>Select your date, gate, purpose, vehicle, and party information.</span>
      </div>

      <div className="wizard-layout">
        <Card title="Access Request Form">
          <form className="form-grid">
            <label>
              Access ID
              <input placeholder="KP-001245" />
            </label>
            <label>
              Requested Date
              <input type="date" />
            </label>
            <label>
              Gate
              <select defaultValue="">
                <option value="" disabled>Select a gate</option>
                <option>Wood Valley</option>
                <option>Honanui</option>
                <option>ʻĀinapō</option>
              </select>
            </label>
            <label>
              Purpose of Entry
              <select defaultValue="">
                <option value="" disabled>Select purpose</option>
                <option>Hunting</option>
                <option>Forest Reserve Access</option>
                <option>Management / Authorized Work</option>
                <option>Other Approved Purpose</option>
              </select>
            </label>
            <label>
              Number in Party
              <input type="number" min="1" placeholder="1" />
            </label>
            <label>
              Vehicle / License Plate
              <input placeholder="Toyota Tacoma / ABC 123" />
            </label>
          </form>
          <button className="button primary form-button">Submit Request</button>
        </Card>

        <Card title="Gate Status">
          <div className="compact-list">
            <div><span>Wood Valley</span><StatusBadge label="Open" tone="green" /></div>
            <div><span>Honanui</span><StatusBadge label="Open" tone="green" /></div>
            <div><span>ʻĀinapō</span><StatusBadge label="Restricted" tone="yellow" /></div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
