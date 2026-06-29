import Link from "next/link";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

const accountProfiles = {
  "kap-2026-00482": {
    accessId: "KAP-2026-00482",
    name: "Kele Fergerstrom",
    status: "Active",
    tone: "green" as const,
    accountType: "Frequent User",
    issued: "06/12/2026",
    expires: "06/30/2028",
    trips: 147,
    lastVisit: "Yesterday",
    phone: "(808) 555-0101",
    email: "kele@example.com",
    organization: "Kapāpala Ranch Access User",
    defaultGate: "Wood Valley",
    defaultPurpose: "Property Access",
    emergencyContact: "Lani Fergerstrom — (808) 555-0199",
    alerts: ["Frequent user", "SMS verified", "No restrictions"],
    vehicles: [
      { label: "White Toyota Tacoma", plate: "KAP482", color: "White", defaultVehicle: true },
      { label: "Polaris Ranger", plate: "RGR501", color: "Green", defaultVehicle: false },
    ],
    tripsList: [
      { date: "Yesterday", gate: "Wood Valley", purpose: "Property Access", status: "Approved" },
      { date: "June 26", gate: "Wood Valley", purpose: "Property Access", status: "Approved" },
      { date: "June 24", gate: "Honanui", purpose: "Fence Check", status: "Approved" },
      { date: "June 20", gate: "Wood Valley", purpose: "Property Access", status: "Approved" },
    ],
    documents: [
      { name: "Driver License", status: "Verified", updated: "06/12/2026" },
      { name: "Access Rules Agreement", status: "Signed", updated: "06/12/2026" },
      { name: "Summit Permit", status: "Not Required", updated: "—" },
    ],
    timeline: [
      { date: "Yesterday", event: "Daily access approved for Wood Valley." },
      { date: "Yesterday", event: "Gate combination SMS delivered successfully." },
      { date: "June 20", event: "Vehicle profile updated: White Toyota Tacoma." },
      { date: "June 12", event: "Access account renewed through June 30, 2028." },
      { date: "June 12", event: "Driver license verified by administrator." },
      { date: "June 12", event: "Access account created." },
    ],
    notes: [
      "Frequent access user. Usually enters through Wood Valley.",
      "Prefers SMS notification.",
      "No current account restrictions.",
    ],
    related: ["Family Group", "Fence Check Crew", "Volunteer Work Party"],
  },
  "kap-2026-00219": {
    accessId: "KAP-2026-00219",
    name: "Demo Hunter",
    status: "Active",
    tone: "green" as const,
    accountType: "Public Hunter",
    issued: "04/17/2026",
    expires: "04/17/2027",
    trips: 42,
    lastVisit: "Today",
    phone: "(808) 555-0188",
    email: "hunter@example.com",
    organization: "—",
    defaultGate: "Honanui",
    defaultPurpose: "Hunting",
    emergencyContact: "Malia Demo — (808) 555-0189",
    alerts: ["SMS verified", "Hunter access", "No restrictions"],
    vehicles: [
      { label: "Ford F-150", plate: "HNL123", color: "Silver", defaultVehicle: true },
    ],
    tripsList: [
      { date: "Today", gate: "Honanui", purpose: "Hunting", status: "Approved" },
      { date: "June 22", gate: "Honanui", purpose: "Hunting", status: "Approved" },
      { date: "June 14", gate: "Wood Valley", purpose: "Hunting", status: "Approved" },
    ],
    documents: [
      { name: "Driver License", status: "Verified", updated: "04/17/2026" },
      { name: "Access Rules Agreement", status: "Signed", updated: "04/17/2026" },
      { name: "Hunting License", status: "On File", updated: "04/17/2026" },
    ],
    timeline: [
      { date: "Today", event: "Daily access approved for Honanui." },
      { date: "Today", event: "Gate combination SMS delivered successfully." },
      { date: "April 17", event: "Driver license verified by administrator." },
      { date: "April 17", event: "Access account approved." },
    ],
    notes: ["Frequent hunter. Uses Honanui most often."],
    related: ["Weekend Hunting Group"],
  },
  "kap-2026-00304": {
    accessId: "KAP-2026-00304",
    name: "Research Team Lead",
    status: "Pending",
    tone: "yellow" as const,
    accountType: "Research",
    issued: "Pending",
    expires: "Pending",
    trips: 0,
    lastVisit: "None",
    phone: "(808) 555-0144",
    email: "research@example.org",
    organization: "University Research Team",
    defaultGate: "ʻĀinapō",
    defaultPurpose: "Research",
    emergencyContact: "Research Office — (808) 555-0110",
    alerts: ["Pending ID review", "Organization listed", "Summit permit may be required"],
    vehicles: [
      { label: "State Vehicle", plate: "STATE04", color: "White", defaultVehicle: true },
    ],
    tripsList: [],
    documents: [
      { name: "Driver License", status: "Pending Review", updated: "Submitted" },
      { name: "Research Authorization", status: "Uploaded", updated: "Submitted" },
      { name: "Access Rules Agreement", status: "Signed", updated: "Submitted" },
    ],
    timeline: [
      { date: "Today", event: "Access account application submitted." },
      { date: "Today", event: "Research authorization uploaded." },
    ],
    notes: ["Awaiting ID validation before account approval."],
    related: ["Research Team Alpha"],
  },
  "kap-2025-00112": {
    accessId: "KAP-2025-00112",
    name: "Suspended Demo",
    status: "Suspended",
    tone: "red" as const,
    accountType: "Public Visitor",
    issued: "05/01/2025",
    expires: "Suspended",
    trips: 11,
    lastVisit: "05/18/2026",
    phone: "(808) 555-0122",
    email: "demo@example.com",
    organization: "—",
    defaultGate: "Wood Valley",
    defaultPurpose: "Hiking",
    emergencyContact: "Demo Contact — (808) 555-0123",
    alerts: ["Account suspended", "Admin review required"],
    vehicles: [
      { label: "Subaru Forester", plate: "SUB112", color: "Gray", defaultVehicle: true },
    ],
    tripsList: [
      { date: "05/18/2026", gate: "Wood Valley", purpose: "Hiking", status: "Approved" },
      { date: "05/11/2026", gate: "Wood Valley", purpose: "Hiking", status: "Approved" },
    ],
    documents: [
      { name: "Driver License", status: "Verified", updated: "05/01/2025" },
      { name: "Access Rules Agreement", status: "Signed", updated: "05/01/2025" },
    ],
    timeline: [
      { date: "June 1", event: "Account suspended by administrator." },
      { date: "May 18", event: "Daily access approved for Wood Valley." },
      { date: "May 1", event: "Access account approved." },
    ],
    notes: ["Suspension placeholder record for UI review."],
    related: [],
  },
};

type AccountId = keyof typeof accountProfiles;

function getAccount(id: string) {
  return accountProfiles[id.toLowerCase() as AccountId] ?? accountProfiles["kap-2026-00482"];
}

export default function AccessAccountProfile({ accountId }: { accountId: string }) {
  const account = getAccount(accountId);

  return (
    <div className="account-profile-page">
      <div className="breadcrumb-row">
        <Link href="/admin/accounts">← Back to Access Accounts</Link>
      </div>

      <section className="profile-hero-card">
        <div className="profile-hero-main">
          <div>
            <p className="eyebrow">Access Account Profile</p>
            <h2>{account.name}</h2>
            <span>{account.accessId}</span>
          </div>
          <StatusBadge label={account.status} tone={account.tone} />
        </div>

        <div className="profile-hero-metrics">
          <div><span>Account Type</span><strong>{account.accountType}</strong></div>
          <div><span>Issued</span><strong>{account.issued}</strong></div>
          <div><span>Expires</span><strong>{account.expires}</strong></div>
          <div><span>Lifetime Trips</span><strong>{account.trips}</strong></div>
          <div><span>Last Visit</span><strong>{account.lastVisit}</strong></div>
          <div><span>Vehicles</span><strong>{account.vehicles.length}</strong></div>
        </div>
      </section>

      <div className="profile-alert-row">
        {account.alerts.map((alert) => (
          <span key={alert}>{alert}</span>
        ))}
      </div>

      <div className="profile-subnav">
        <a href="#overview">Overview</a>
        <a href="#vehicles">Vehicles</a>
        <a href="#trips">Trips</a>
        <a href="#documents">Documents</a>
        <a href="#timeline">Timeline</a>
        <a href="#notes">Notes</a>
      </div>

      <div className="profile-layout-grid">
        <main className="profile-main-column">
          <Card title="Overview">
            <div id="overview" className="profile-detail-grid">
              <div><span>Phone</span><strong>{account.phone}</strong></div>
              <div><span>Email</span><strong>{account.email}</strong></div>
              <div><span>Organization</span><strong>{account.organization}</strong></div>
              <div><span>Default Gate</span><strong>{account.defaultGate}</strong></div>
              <div><span>Default Purpose</span><strong>{account.defaultPurpose}</strong></div>
              <div><span>Emergency Contact</span><strong>{account.emergencyContact}</strong></div>
            </div>
          </Card>

          <Card title="Registered Vehicles">
            <div id="vehicles" className="vehicle-card-list">
              {account.vehicles.map((vehicle) => (
                <div key={vehicle.plate} className="vehicle-card">
                  <div>
                    <strong>{vehicle.label}</strong>
                    <span>{vehicle.color} • Plate {vehicle.plate}</span>
                  </div>
                  {vehicle.defaultVehicle && <StatusBadge label="Default" tone="green" />}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Recent Trips">
            <div id="trips" className="trip-history-table">
              <div>
                <span>Date</span>
                <span>Gate</span>
                <span>Purpose</span>
                <span>Status</span>
              </div>
              {account.tripsList.length === 0 ? (
                <p className="muted-text">No trips have been approved for this account yet.</p>
              ) : (
                account.tripsList.map((trip) => (
                  <div key={`${trip.date}-${trip.gate}`}>
                    <strong>{trip.date}</strong>
                    <span>{trip.gate}</span>
                    <span>{trip.purpose}</span>
                    <StatusBadge label={trip.status} tone="green" />
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card title="Documents">
            <div id="documents" className="document-list">
              {account.documents.map((doc) => (
                <div key={doc.name}>
                  <div>
                    <strong>{doc.name}</strong>
                    <span>Updated: {doc.updated}</span>
                  </div>
                  <span>{doc.status}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Account Timeline">
            <div id="timeline" className="profile-timeline-list">
              {account.timeline.map((item) => (
                <div key={`${item.date}-${item.event}`}>
                  <span>{item.date}</span>
                  <strong>{item.event}</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Administrator Notes">
            <div id="notes" className="admin-note-list">
              {account.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </Card>
        </main>

        <aside className="profile-side-column">
          <Card title="Quick Actions">
            <div className="profile-action-list">
              <button className="button secondary" type="button">Edit Account</button>
              <button className="button secondary" type="button">Renew Account</button>
              <button className="button secondary" type="button">Send SMS</button>
              <button className="button secondary" type="button">Send Email</button>
              <button className="button secondary" type="button">Print Access Card</button>
              <button className="button secondary" type="button">Export PDF</button>
              <button className="button danger" type="button">Suspend Account</button>
            </div>
          </Card>

          <Card title="Related Accounts">
            {account.related.length === 0 ? (
              <p className="muted-text">No related accounts listed.</p>
            ) : (
              <div className="related-account-list">
                {account.related.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
          </Card>

          <Card title="Access Card Preview">
            <div className="access-card-preview">
              <p>Kapāpala Ranch</p>
              <h3>{account.name}</h3>
              <strong>{account.accessId}</strong>
              <div className="qr-placeholder">QR</div>
              <StatusBadge label={account.status} tone={account.tone} />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
