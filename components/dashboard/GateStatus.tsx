import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

const gates = [
  { name: "Wood Valley", description: "Public Entrance Gate", status: "Open", tone: "green", road: "Normal" },
  { name: "Honanui", description: "Public Access Gate", status: "Open", tone: "green", road: "Normal" },
  { name: "ʻĀinapō", description: "Upper Forest Access", status: "Restricted", tone: "yellow", road: "4WD recommended" },
] as const;

export default function GateStatus() {
  return (
    <Card title="Gate Access Status">
      <div className="gate-grid">
        {gates.map((gate) => (
          <div className="gate-card" key={gate.name}>
            <div className="gate-card-top">
              <div>
                <h3>{gate.name}</h3>
                <p>{gate.description}</p>
              </div>
              <StatusBadge label={gate.status} tone={gate.tone} />
            </div>
            <div className="gate-meta">
              <span>Road Condition</span>
              <strong>{gate.road}</strong>
            </div>
            <div className="gate-meta">
              <span>Gate Combination</span>
              <strong>Available after approval</strong>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
