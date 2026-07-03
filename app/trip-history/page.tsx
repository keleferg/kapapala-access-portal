import AppShell from "../../components/layout/AppShell";
import TripHistoryList from "../../components/access/TripHistoryList";

export default function TripHistoryPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Access</p>

        <h2>Trip History</h2>

        <span>
          View your historical access requests prior to the current day.
        </span>
      </div>

      <TripHistoryList />
    </AppShell>
  );
}