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
          <Link href="/admin"><span>⚙️</span>Admin Portal</Link>
          <Link href="/admin/gates"><span>🔐</span>Gate Combinations</Link>
        </div>
      </nav>

      <div className="sidebar-footer">
        <strong>Mālama i ka ʻĀina</strong>
        <small>Respect the land. Secure every gate.</small>
      </div>
    </aside>
  );
}
