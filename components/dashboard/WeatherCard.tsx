"use client";

import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { useCurrentConditions } from "../../lib/hooks/useCurrentConditions";

function fireTone(status: string): "green" | "yellow" | "red" {
  switch (status.toLowerCase()) {
    case "low":
    case "normal":
      return "green";

    case "moderate":
    case "elevated":
      return "yellow";

    default:
      return "red";
  }
}

function roadTone(status: string): "green" | "yellow" | "red" {
  switch (status.toLowerCase()) {
    case "open":
    case "good":
      return "green";

    case "caution":
    case "restricted":
    case "fair":
      return "yellow";

    default:
      return "red";
  }
}

export default function WeatherCard() {
  const { conditions, loading, error } = useCurrentConditions();

  if (loading) {
    return (
      <Card title="Current Conditions" subtitle="Kapāpala">
        <div className="dashboard-card-compact-value">Loading...</div>
        <p className="muted-text">Checking current conditions.</p>
      </Card>
    );
  }

  if (error || !conditions) {
    return (
      <Card title="Current Conditions" subtitle="Kapāpala">
        <div className="dashboard-card-compact-value">Unavailable</div>
        <StatusBadge label="Error" tone="red" />
      </Card>
    );
  }

  return (
    <Card
      title="Current Conditions"
      subtitle={`Updated ${new Date(
        conditions.lastUpdated
      ).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`}
    >
      <div className="dashboard-weather-summary">
        <div>
          <span>Weather</span>
          <strong>{conditions.weather?.condition ?? "Unavailable"}</strong>
        </div>

        <div>
          <span>Temp</span>
          <strong>
            {conditions.weather?.temperature != null
              ? `${conditions.weather.temperature}°`
              : "--"}
          </strong>
        </div>
      </div>

      <div className="dashboard-status-row">
        <StatusBadge label={conditions.roadStatus} tone={roadTone(conditions.roadStatus)} />
        <StatusBadge label={conditions.fireStatus} tone={fireTone(conditions.fireStatus)} />
      </div>
    </Card>
  );
}