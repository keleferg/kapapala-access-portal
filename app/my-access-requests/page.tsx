import AppShell from "../../components/layout/AppShell";
import MyAccessRequestsList from "../../components/access/MyAccessRequestsList";

export default function MyAccessRequestsPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Access</p>

        <h2>My Access Requests</h2>

        <span>
          View your current and past daily access requests from the last year.
        </span>
      </div>

      <MyAccessRequestsList />
    </AppShell>
  );
}