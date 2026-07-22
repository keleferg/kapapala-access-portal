import AppShell from "../../components/layout/AppShell";
import HeroBanner from "../../components/dashboard/HeroBanner";
import QuickActions from "../../components/dashboard/QuickActions";
import AccessCard from "../../components/dashboard/AccessCard";
import NextTripCard from "../../components/dashboard/NextTripCard";
import WeatherCard from "../../components/dashboard/WeatherCard";
import GateStatusSection from "../../components/dashboard/GateStatusSection";
import NoticesCard from "../../components/dashboard/NoticesCard";
import StewardshipCard from "../../components/dashboard/StewardshipCard";
import RenewalStatusCard from "../../components/dashboard/RenewalStatusCard";

export default function DashboardPage() {
  return (
    <AppShell>
      <HeroBanner />

      <QuickActions />

      <div className="card-grid three dashboard-summary-row">
        <AccessCard />
        <NextTripCard />
        <WeatherCard />
      </div>

      <RenewalStatusCard />

      <GateStatusSection />

      <div className="card-grid two">
        <NoticesCard />
        <StewardshipCard />
      </div>
    </AppShell>
  );
}