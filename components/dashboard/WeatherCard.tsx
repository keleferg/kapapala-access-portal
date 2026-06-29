import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

export default function WeatherCard() {
  return (
    <Card title="Current Conditions" subtitle="Demo data">
      <div className="condition-grid">
        <div><span>Weather</span><strong>Normal</strong></div>
        <div><span>Wind</span><strong>NE 12 mph</strong></div>
        <div><span>Roads</span><strong>Passable</strong></div>
        <div><span>Fire Danger</span><StatusBadge label="Moderate" tone="yellow" /></div>
      </div>
    </Card>
  );
}
