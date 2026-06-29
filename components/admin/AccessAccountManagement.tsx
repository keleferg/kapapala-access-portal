import Link from "next/link";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

const accessAccounts = [
  {
    accessId: "KAP-2026-00482",
    name: "Kele Fergerstrom",
    phone: "(808) 555-0101",
    email: "kele@example.com",
    status: "Active",
    tone: "green" as const,
    expires: "06/30/2028",
    lastVisit: "Yesterday",
    trips: 147,
    vehicles: "White Tacoma, Polaris Ranger",
    slug: "kap-2026-00482",
  },
  {
    accessId: "KAP-2026-00219",
    name: "Demo Hunter",
    phone: "(808) 555-0188",
    email: "hunter@example.com",
    status: "Active",
    tone: "green" as const,
    expires: "04/17/2027",
    lastVisit: "Today",
    trips: 42,
    vehicles: "Ford F-150 / HNL123",
    slug: "kap-2026-00219",
  },
  {
    accessId: "KAP-2026-00304",
    name: "Research Team Lead",
    phone: "(808) 555-0144",
    email: "research@example.org",
    status: "Pending",
    tone: "yellow" as const,
    expires: "Pending",
    lastVisit: "None",
    trips: 0,
    vehicles: "State Vehicle",
    slug: "kap-2026-00304",
  },
  {
    accessId: "KAP-2025-00112",
    name: "Suspended Demo",
    phone: "(808) 555-0122",
    email: "demo@example.com",
    status: "Suspended",
    tone: "red" as const,
    expires: "Suspended",
    lastVisit: "05/18/2026",
    trips: 11,
    vehicles: "Gray Subaru Forester",
    slug: "kap-2025-00112",
  },
];

const timeline = [
  { date: "Today", event: "Daily access request approved for Wood Valley." },
  { date: "Yesterday", event: "Gate combination SMS delivered successfully." },
  { date: "June 20", event: "Vehicle profile updated: White Tacoma." },
  { date: "June 12", event: "Access account renewed through June 30, 2028." },
];

export default function AccessAccountManagement() {
  const selected = accessAccounts[0];

  return (
    <div className="account-management-layout">
      <Card title="Access Accounts">
        <div className="account-toolbar">
          <input
            aria-label="Search access accounts"
            placeholder="Search by name, Access ID, phone, email, or license plate"
          />
          <button className="button primary" type="button">Search</button>
        </div>

        <div className="filter-chip-row">
          <button className="filter-chip active" type="button">Active</button>
          <button className="filter-chip" type="button">Pending</button>
          <button className="filter-chip" type="button">Expired</button>
          <button className="filter-chip" type="button">Suspended</button>
          <button className="filter-chip" type="button">Revoked</button>
        </div>

        <div className="accounts-table">
          <div>
            <span>Access ID</span>
            <span>Name</span>
            <span>Status</span>
            <span>Expires</span>
            <span>Last Visit</span>
            <span>Trips</span>
            <span>Vehicles</span>
          </div>
          {accessAccounts.map((account) => (
            <div key={account.accessId} className={account.accessId === selected.accessId ? "selected" : ""}>
              <strong><Link href={`/admin/accounts/${account.slug}`}>{account.accessId}</Link></strong>
              <span><Link href={`/admin/accounts/${account.slug}`}>{account.name}</Link></span>
              <StatusBadge label={account.status} tone={account.tone} />
              <span>{account.expires}</span>
              <span>{account.lastVisit}</span>
              <span>{account.trips}</span>
              <span>{account.vehicles}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="account-profile-column">
        <Card title="360° Account Overview">
          <div className="profile-header-row">
            <div>
              <h2>{selected.name}</h2>
              <p>{selected.accessId}</p>
            </div>
            <StatusBadge label={selected.status} tone={selected.tone} />
          </div>

          <div className="profile-metric-grid">
            <div><span>Expires</span><strong>{selected.expires}</strong></div>
            <div><span>Lifetime Trips</span><strong>{selected.trips}</strong></div>
            <div><span>Last Visit</span><strong>{selected.lastVisit}</strong></div>
            <div><span>Vehicles</span><strong>2 Registered</strong></div>
          </div>
        </Card>

        <Card title="Contact & Vehicles">
          <div className="profile-detail-list">
            <div><span>Phone</span><strong>{selected.phone}</strong></div>
            <div><span>Email</span><strong>{selected.email}</strong></div>
            <div><span>Vehicles</span><strong>{selected.vehicles}</strong></div>
            <div><span>Emergency Contact</span><strong>(808) 555-0199</strong></div>
          </div>
        </Card>

        <Card title="Administrator Notes">
          <p className="muted-text">
            Frequent access user. Usually enters through Wood Valley. Prefers SMS
            notification. No current account restrictions.
          </p>
        </Card>

        <Card title="Recent Timeline">
          <div className="timeline-list">
            {timeline.map((item) => (
              <div key={`${item.date}-${item.event}`}>
                <span>{item.date}</span>
                <strong>{item.event}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Quick Actions">
          <div className="quick-action-button-grid">
            <button className="button secondary" type="button">Edit Account</button>
            <button className="button secondary" type="button">Renew</button>
            <button className="button secondary" type="button">Send SMS</button>
            <button className="button secondary" type="button">View Trips</button>
            <button className="button secondary" type="button">Print Access Card</button>
            <button className="button danger" type="button">Suspend</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
