import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

const requests = [
  {
    name: "Kele Fergerstrom",
    accessId: "KP-2026-00482",
    gate: "Wood Valley",
    date: "Today",
    purpose: "Property Access",
    party: "1",
    vehicle: "White Tacoma",
    status: "Ready",
    tone: "green" as const,
  },
  {
    name: "Demo Hunter",
    accessId: "KP-2026-00219",
    gate: "Honanui",
    date: "Today",
    purpose: "Hunting",
    party: "2",
    vehicle: "Ford F-150 / HNL123",
    status: "Ready",
    tone: "green" as const,
  },
  {
    name: "Research Team",
    accessId: "KP-2026-00304",
    gate: "ʻĀinapō",
    date: "Tomorrow",
    purpose: "Research",
    party: "4",
    vehicle: "Two vehicles",
    status: "Review",
    tone: "yellow" as const,
  },
];

export default function DailyAccessQueue() {
  return (
    <Card title="Daily Access Request Queue">
      <div className="admin-toolbar">
        <div>
          <strong>Requests needing action</strong>
          <p>Approve, hold for review, or resend gate combination SMS.</p>
        </div>
        <button className="button primary">Approve Ready Requests</button>
      </div>

      <div className="request-queue-list">
        {requests.map((request) => (
          <div className="request-queue-item" key={`${request.accessId}-${request.gate}`}>
            <div className="request-main">
              <div>
                <h3>{request.name}</h3>
                <p>{request.accessId}</p>
              </div>
              <StatusBadge label={request.status} tone={request.tone} />
            </div>

            <div className="request-details-grid">
              <div>
                <span>Gate</span>
                <strong>{request.gate}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{request.date}</strong>
              </div>
              <div>
                <span>Purpose</span>
                <strong>{request.purpose}</strong>
              </div>
              <div>
                <span>Party</span>
                <strong>{request.party}</strong>
              </div>
              <div className="wide">
                <span>Vehicle</span>
                <strong>{request.vehicle}</strong>
              </div>
            </div>

            <div className="review-actions">
              <button className="button primary">Approve & Send SMS</button>
              <button className="button secondary">Hold for Review</button>
              <button className="button secondary">View Details</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
