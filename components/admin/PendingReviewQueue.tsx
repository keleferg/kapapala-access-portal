import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

const pendingReviews = [
  {
    name: "Kawika Demo",
    phone: "(808) 555-0171",
    purpose: "Hunting",
    submitted: "Today, 8:12 AM",
    vehicle: "White Toyota Tacoma",
  },
  {
    name: "Malia Demo",
    phone: "(808) 555-0199",
    purpose: "Forest Reserve Access",
    submitted: "Yesterday, 4:31 PM",
    vehicle: "Gray Subaru Forester",
  },
  {
    name: "Research Group Demo",
    phone: "(808) 555-0144",
    purpose: "Research",
    submitted: "Yesterday, 11:05 AM",
    vehicle: "State Vehicle",
  },
];

export default function PendingReviewQueue() {
  return (
    <Card title="Pending Access Account Reviews">
      <div className="review-queue">
        {pendingReviews.map((review) => (
          <div className="review-card" key={review.name}>
            <div className="review-main">
              <div className="review-avatar">🪪</div>
              <div>
                <h3>{review.name}</h3>
                <p>{review.phone}</p>
                <div className="review-meta-row">
                  <span>{review.purpose}</span>
                  <span>{review.vehicle}</span>
                  <span>{review.submitted}</span>
                </div>
              </div>
            </div>

            <div className="review-actions">
              <StatusBadge label="ID Pending" tone="yellow" />
              <button className="button secondary" type="button">
                View ID
              </button>
              <button className="button primary" type="button">
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
