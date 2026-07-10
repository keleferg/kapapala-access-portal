import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

const gates = [
  {
    name: "Wood Valley",
    description: "Public Entrance Gate",
    status: "Open",
    tone: "green",
    operatingHours: "6:00 AM – 6:00 PM",
  },
  {
    name: "Honanui",
    description: "Public Access Gate",
    status: "Open",
    tone: "green",
    operatingHours: "6:00 AM – 6:00 PM",
  },
  {
    name: "ʻĀinapō",
    description: "Upper Forest Access",
    status: "Restricted",
    tone: "yellow",
    operatingHours: "6:00 AM – 6:00 PM",
  },
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
              <span>Operating Hours</span>
              <strong>{gate.operatingHours}</strong>
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