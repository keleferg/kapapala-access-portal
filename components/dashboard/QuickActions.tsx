import QuickActionCard from "./QuickActionCard";

export default function QuickActions() {
  return (
    <div className="quick-action-grid">
      <QuickActionCard icon="🚙" title="Request Access" description="Submit a new daily access request." href="/request-access" />
      <QuickActionCard icon="📅" title="My Trips" description="View upcoming and previous access requests." href="/dashboard" />
      <QuickActionCard icon="🗺️" title="Maps & Gates" description="Review gate locations and road information." href="/admin/gates" />
      <QuickActionCard icon="📖" title="Rules & Safety" description="Review public access rules and safety notices." href="/dashboard" />
    </div>
  );
}
