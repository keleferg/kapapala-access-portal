import Link from "next/link";
import AppShell from "../../components/layout/AppShell";
import AdminOperationsTabs from "../../components/admin/AdminOperationsTabs";
import LiveActivityBar from "../../components/admin/LiveActivityBar";

const quickActions = [
  {
    href: "/admin/reviews",
    label: "Review Accounts",
    description: "Process pending access account applications",
    icon: "accounts",
  },
  {
    href: "/admin/requests",
    label: "Access Requests",
    description: "Review today, pending, and future requests",
    icon: "requests",
  },
  {
    href: "/admin/access-accounts",
    label: "Lookup Account",
    description: "Find an Access ID or account holder",
    icon: "lookup",
  },
  {
    href: "/admin/gates",
    label: "Manage Gates",
    description: "Gate status, combinations, hours, and iBeacon",
    icon: "gates",
  },
] as const;

function QuickActionIcon({
  icon,
}: {
  icon: (typeof quickActions)[number]["icon"];
}) {
  if (icon === "accounts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0Z" />
        <path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
      </svg>
    );
  }

  if (icon === "requests") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4h12a2 2 0 0 1 2 2v14H4V6a2 2 0 0 1 2-2Z" />
        <path d="M8 2v4M16 2v4M4 9h16M8 13h3M8 17h6" />
      </svg>
    );
  }

  if (icon === "lookup") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16l5 5M8 10h5M10.5 7.5v5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 12h6M12 9v6M7 3v18M17 3v18" />
    </svg>
  );
}

export default function AdminPage() {
  return (
    <AppShell variant="admin">
      <div className="admin-dashboard">
        <section className="admin-dashboard-hero">
          <div className="admin-dashboard-hero__main">
            <span className="admin-dashboard-hero__eyebrow">
              Administration
            </span>

            <h2>Kapāpala Access Operations</h2>

            <p>
              Monitor today&apos;s activity, review access requests, manage
              accounts, and keep each forest reserve gate operating safely.
            </p>

            <div className="admin-dashboard-hero__status">
              <span className="admin-dashboard-hero__status-dot" />
              Operations dashboard is connected
            </div>
          </div>

          <aside className="admin-dashboard-hero__aside">
            <span className="admin-dashboard-hero__aside-label">
              Operations focus
            </span>

            <h3>Keep today moving</h3>

            <p>
              Address pending requests first, verify gate readiness, and monitor
              code reveals and visitor exits.
            </p>

            <Link href="/admin/requests" className="admin-dashboard-hero__button">
              Open today&apos;s requests
              <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </section>

        <section className="admin-quick-actions" aria-labelledby="quick-actions-title">
          <div className="admin-section-heading">
            <div>
              <span>Workspace</span>
              <h2 id="quick-actions-title">Quick actions</h2>
            </div>

            <p>Frequently used administrative tools</p>
          </div>

          <div className="admin-quick-actions__grid">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="admin-quick-action"
              >
                <span className="admin-quick-action__icon">
                  <QuickActionIcon icon={action.icon} />
                </span>

                <span className="admin-quick-action__content">
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>

                <span className="admin-quick-action__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <LiveActivityBar />

        <section className="admin-workspace">
          <div className="admin-section-heading">
            <div>
              <span>Live work queues</span>
              <h2>Operations center</h2>
            </div>

            <p>
              Review account applications, daily requests, and gate
              configuration.
            </p>
          </div>

          <AdminOperationsTabs />
        </section>
      </div>
    </AppShell>
  );
}
