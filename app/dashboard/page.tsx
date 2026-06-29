import AppShell from "../../components/layout/AppShell";
import HeroBanner from "../../components/dashboard/HeroBanner";
import QuickActions from "../../components/dashboard/QuickActions";
import AccessCard from "../../components/dashboard/AccessCard";
import WeatherCard from "../../components/dashboard/WeatherCard";
import NoticesCard from "../../components/dashboard/NoticesCard";
import StewardshipCard from "../../components/dashboard/StewardshipCard";
import GateStatus from "../../components/dashboard/GateStatus";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";

export default function DashboardPage() {
  return (
    <AppShell>
      <HeroBanner />
      <QuickActions />

      <div className="card-grid three">
        <AccessCard />
        <Card title="Next Trip" subtitle="Upcoming access">
          <div className="big-value">July 4</div>
          <p className="muted-text">Wood Valley • Approved</p>
          <StatusBadge label="Combination Pending" tone="gray" />
        </Card>
        <WeatherCard />
      </div>

      <GateStatus />

      <div className="card-grid two">
        <NoticesCard />
        <StewardshipCard />
      </div>
    </AppShell>
  );
}
