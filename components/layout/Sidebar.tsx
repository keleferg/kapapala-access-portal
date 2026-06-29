import Link from "next/link";

const mainLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/request-access", label: "Request Access", icon: "🚙" },
  { href: "/apply", label: "My Access Account", icon: "🪪" },
  { href: "/dashboard", label: "Upcoming Trips", icon: "📅" },
  { href: "/dashboard", label: "Trip History", icon: "📜" },
];

const infoLinks = [
  { href: "/admin/gates", label: "Maps & Gates", icon: "🗺️" },
  { href: "/dashboard", label: "Current Conditions", icon: "🌤" },
  { href: "/dashboard", label: "Rules & Safety", icon: "📖" },
];

const adminLinks = [
  { href: "/admin", label: "Admin Dashboard", icon: "📊" },
  { href: "/admin/reviews", label: "Access Account Request Queue", icon: "📥" },
  { href: "/admin/access-accounts", label: "Access Accounts", icon: "👤" },
  { href: "/admin/requests", label: "Daily Access Request Queue", icon: "🚙" },
  { href: "/admin/gates", label: "Gate Combination Manager", icon: "🔐" },
  { href: "/admin/workflows", label: "Workflow Engine", icon: "🔁" },
  { href: "/admin/business-rules", label: "Business Rules", icon: "📋" },
  { href: "/admin/communications", label: "Communications Center", icon: "📱" },
  { href: "/admin/notifications", label: "Notifications", icon: "🔔" },
  { href: "/admin/configuration", label: "Configuration", icon: "⚙️" },
  { href: "/admin/reports", label: "Reports", icon: "📈" },
  { href: "/admin/system-log", label: "System Log", icon: "📜" },
  { href: "/admin/schema-preview", label: "Backend Schema", icon: "🧱" },
  { href: "/admin/auth", label: "Auth & Roles", icon: "🔑" },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">🌿</div>
        <div>
          <div className="brand-title">Kapāpala</div>
          <div className="brand-subtitle">Access Portal</div>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-section">
          <div className="nav-heading">Main</div>
          {mainLinks.map((link) => (
            <Link key={link.label} href={link.href}>
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-heading">Information</div>
          {infoLinks.map((link) => (
            <Link key={link.label} href={link.href}>
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-heading">Administration</div>
          {adminLinks.map((link) => (
            <Link key={link.label} href={link.href}>
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="sidebar-footer">
        <strong>Mālama i ka ʻĀina</strong>
        <small>Respect the land. Secure every gate.</small>
      </div>
    </aside>
  );
}
