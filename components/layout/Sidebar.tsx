"use client";

import Link from "next/link";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";

const mainLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/request-access", label: "Request Access", icon: "🚙" },
  { href: "/apply", label: "My Access Account", icon: "🪪" },
  { href: "/my-access-requests", label: "My Access Requests", icon: "📅" },
  { href: "/trip-history", label: "Trip History", icon: "📜" },
];

const infoLinks = [
  {
    href: "/information/forest-reserve-access",
    label: "Forest Reserve Access",
    icon: "🌲",
  },
  {
    href: "/information/gates",
    label: "Gates & Access Roads",
    icon: "🗺️",
  },
  {
    href: "/information/rules-safety",
    label: "Rules & Safety",
    icon: "📖",
  },
  {
    href: "/information/overnight-hikers",
    label: "Overnight Hikers",
    icon: "⛺",
  },
  {
    href: "/information/faq",
    label: "FAQ",
    icon: "❓",
  },
];

const adminLinks = [
  { href: "/admin", label: "Admin Dashboard", icon: "📊" },
  { href: "/admin/reviews", label: "Access Account Review Queue", icon: "📥" },
  { href: "/admin/access-accounts", label: "Access Accounts", icon: "🪪" },
  { href: "/admin/requests", label: "Daily Access Requests", icon: "🚙" },
  { href: "/admin/gates", label: "Gate Combination Manager", icon: "🔐" },
  { href: "/admin/communications", label: "Communications Center", icon: "📱" },
  { href: "/admin/reports", label: "Reports", icon: "📈" },
  { href: "/admin/system-log", label: "System Log", icon: "📜" },
  { href: "/admin/auth", label: "Auth & Roles", icon: "🔑" },
];

const configurationLinks = [
  { href: "/admin/configuration", label: "Configuration", icon: "⚙️" },
  { href: "/admin/workflows", label: "Workflow Engine", icon: "🔁" },
  { href: "/admin/business-rules", label: "Business Rules", icon: "📋" },
  { href: "/admin/schema-preview", label: "Backend Schema", icon: "🧱" },
];

export default function Sidebar() {
  const { isAdmin, loading } = useCurrentUser();

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

        {!loading && isAdmin && (
          <>
            <div className="nav-section">
              <div className="nav-heading">Administration</div>

              {adminLinks.map((link) => (
                <Link key={link.label} href={link.href}>
                  <span>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="nav-section">
              <div className="nav-heading">Configuration</div>

              {configurationLinks.map((link) => (
                <Link key={link.label} href={link.href}>
                  <span>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <strong>Mālama i ka ʻĀina</strong>
        <small>Respect the land. Secure every gate.</small>
      </div>
    </aside>
  );
}