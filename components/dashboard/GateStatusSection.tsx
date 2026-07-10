"use client";

import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { useCurrentConditions } from "../../lib/hooks/useCurrentConditions";

type GateAdvisoryFields = {
  name?: string | null;
  public_note?: string | null;
  publicNote?: string | null;
  road_condition?: string | null;
  roadCondition?: string | null;
  notes?: string | null;
};

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

function normalizeGateName(name?: string | null) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getGateAdvisory(gate: GateAdvisoryFields) {
  const savedAdvisory =
    gate.public_note?.trim() ||
    gate.publicNote?.trim() ||
    gate.road_condition?.trim() ||
    gate.roadCondition?.trim() ||
    gate.notes?.trim();

  if (savedAdvisory) {
    return savedAdvisory;
  }

  const normalizedName = normalizeGateName(gate.name);

  if (normalizedName.includes("wood valley")) {
    return "4WD Required, ATV, UTV";
  }

  if (normalizedName.includes("honanui")) {
    return "4WD Required, ATV, UTV";
  }

  if (normalizedName.includes("ainapo")) {
    return "4WD Required, ATV, UTV. Hiking/Bicycles/Horses permitted.";
  }

  return "No current road advisory posted.";
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

            <p>{getGateAdvisory(gate)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}