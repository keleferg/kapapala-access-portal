"use client";

import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { useCurrentConditions } from "../../lib/hooks/useCurrentConditions";

function gateTone(status: string): "green" | "yellow" | "red" {
  switch (status.toLowerCase()) {
    case "open":
      return "green";

    case "restricted":
      return "yellow";

    default:
      return "red";
  }
}

function gateStatusClass(status: string) {
  switch (status.toLowerCase()) {
    case "open":
      return "gate-status-open";

    case "restricted":
      return "gate-status-restricted";

    case "closed":
      return "gate-status-closed";

    default:
      return "gate-status-unknown";
  }
}

export default function GateStatusSection() {
  const { conditions, loading, error } = useCurrentConditions();

  if (loading) {
    return (
      <Card title="Gate Status">
        <p className="muted-text">Loading gate status...</p>
      </Card>
    );
  }

  if (error || !conditions) {
    return (
      <Card title="Gate Status">
        <p className="muted-text">Unable to load gate status.</p>
      </Card>
    );
  }

  return (
    <Card title="Gate Status" subtitle="Current gate and road advisories">
      <div className="dashboard-gate-status-list">
        {conditions.gates.map((gate) => (
          <div
            className={`dashboard-gate-status-item ${gateStatusClass(
              gate.status
            )}`}
            key={gate.id}
          >
            <div className="dashboard-gate-status-header">
              <strong>{gate.name}</strong>
              <StatusBadge label={gate.status} tone={gateTone(gate.status)} />
            </div>

            <p>{conditions.roadNotes || "No current road advisory posted."}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}