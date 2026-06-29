import StatusBadge from "../ui/StatusBadge";

const activityItems = [
  { label: "New Account Requests", value: "4", note: "Awaiting review", tone: "yellow" as const },
  { label: "Daily Requests Today", value: "18", note: "14 ready to approve", tone: "green" as const },
  { label: "SMS Sent", value: "16", note: "1 delivery issue", tone: "green" as const },
  { label: "Gate Status", value: "All Open", note: "ʻĀinapō restricted", tone: "yellow" as const },
];

export default function LiveActivityBar() {
  return (
    <section className="live-activity-bar">
      <div className="live-activity-heading">
        <span>Live Activity</span>
        <strong>Today&apos;s Operations</strong>
      </div>

      <div className="live-activity-items">
        {activityItems.map((item) => (
          <div className="live-activity-item" key={item.label}>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </div>
            <StatusBadge label={item.tone === "green" ? "OK" : "Watch"} tone={item.tone} />
          </div>
        ))}
      </div>
    </section>
  );
}
