import QuickActionCard from "./QuickActionCard";

export default function QuickActions() {
  return (
    <div className="quick-action-grid">
      <QuickActionCard
        icon="🚙"
        title="Request Access"
        description="Submit a new daily access request."
        href="/request-access"
      />

      <QuickActionCard
        icon="📅"
        title="My Trips"
        description="View upcoming and current access requests."
        href="/my-access-requests"
      />

      <QuickActionCard
        icon="📜"
        title="My Past Requests"
        description="View your past access requests."
        href="/trip-history"
      />

      <QuickActionCard
        icon="📖"
        title="Rules & Safety"
        description="Review Kapāpala Ranch's Kapāpala Forest Reserve access rules and safety notices."
        href="https://kapapalaranch.com/forest-reserve-access"
      />
    </div>
  );
}