import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

const gateRows = [
  {
    name: "Wood Valley",
    status: "Open",
    tone: "green" as const,
    todayCombo: "4317",
    tomorrowCombo: "9824",
    road: "Good",
    notes: "Normal public entrance operations.",
  },
  {
    name: "Honanui",
    status: "Open",
    tone: "green" as const,
    todayCombo: "6729",
    tomorrowCombo: "1184",
    road: "Fair",
    notes: "Use caution after heavy rain.",
  },
  {
    name: "ʻĀinapō",
    status: "Restricted",
    tone: "yellow" as const,
    todayCombo: "9041",
    tomorrowCombo: "5502",
    road: "4WD Recommended",
    notes: "Upper forest access; verify conditions before approval.",
  },
];

export default function GateCombinationManager() {
  return (
    <div className="gate-manager-grid">
      {gateRows.map((gate) => (
        <Card key={gate.name} title={gate.name}>
          <div className="gate-manager-header">
            <StatusBadge label={gate.status} tone={gate.tone} />
            <span>{gate.road}</span>
          </div>

          <div className="combo-box">
            <span>Today&apos;s Combination</span>
            <strong>{gate.todayCombo}</strong>
          </div>

          <form className="single-column-form">
            <label>
              Date
              <input type="date" />
            </label>
            <label>
              Combination
              <input defaultValue={gate.tomorrowCombo} />
            </label>
            <label>
              Gate Status
              <select defaultValue={gate.status}>
                <option>Open</option>
                <option>Restricted</option>
                <option>Closed</option>
              </select>
            </label>
            <label>
              Road Condition / Notes
              <textarea defaultValue={gate.notes} />
            </label>
          </form>

          <button className="button primary form-button">Save Gate Combination</button>
        </Card>
      ))}
    </div>
  );
}
