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
    case "normal":
      return "green";

    case "caution":
    case "restricted":
    case "fair":
      return "yellow";

    default:
      return "red";
  }
}

function displayStatus(value: string | null | undefined) {
  if (!value) return "Unavailable";

  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
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

  const updatedTime = new Date(conditions.lastUpdated).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const weatherCondition = conditions.weather?.condition ?? "Unavailable";
  const temperature =
    conditions.weather?.temperature != null
      ? `${conditions.weather.temperature}°`
      : "--";

  const roadStatus = conditions.roadStatus || "Unavailable";
  const fireStatus = conditions.fireStatus || "Unavailable";

  return (
    <Card title="Current Conditions" subtitle={`Updated ${updatedTime}`}>
      <div className="dashboard-weather-summary">
        <div>
          <span>Weather</span>
          <strong>{weatherCondition}</strong>
        </div>

        <div>
          <span>Temp</span>
          <strong>{temperature}</strong>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.65rem",
          marginTop: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <span className="muted-text">Road / Access</span>
          <StatusBadge
            label={displayStatus(roadStatus)}
            tone={roadTone(roadStatus)}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <span className="muted-text">Fire Risk</span>
          <StatusBadge
            label={displayStatus(fireStatus)}
            tone={fireTone(fireStatus)}
          />
        </div>
      </div>
    </Card>
  );
}