"use client";

import Link from "next/link";
import { useCurrentUser } from "../../lib/hooks/useCurrentUser";

type SidebarLink = {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
};

const mainLinks: SidebarLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/request-access", label: "Request Access", icon: "🚙" },
  { href: "/apply", label: "My Access Account", icon: "🪪" },
  { href: "/my-access-requests", label: "My Access Requests", icon: "📅" },
  { href: "/trip-history", label: "Trip History", icon: "📜" },
];

const infoLinks: SidebarLink[] = [
  {
    href: "https://kapapalaranch.com/forest-reserve-access",
    label: "Forest Reserve Access",
    icon: "🌲",
    external: true,
  },
];

const adminLinks: SidebarLink[] = [
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

const configurationLinks: SidebarLink[] = [
  { href: "/admin/configuration", label: "Configuration", icon: "⚙️" },
  { href: "/admin/workflows", label: "Workflow Engine", icon: "🔁" },
  { href: "/admin/business-rules", label: "Business Rules", icon: "📋" },
  { href: "/admin/schema-preview", label: "Backend Schema", icon: "🧱" },
];

function SidebarNavItem({ link }: { link: SidebarLink }) {
  const content = (
    <>
      <span className="icon" aria-hidden="true">
        {link.icon}
      </span>
      <span className="text">{link.label}</span>
    </>
  );

  if (link.external) {
    return (
      <li className="sidebar__item">
        <a
          className="sidebar__link"
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          data-tooltip={link.label}
        >
          {content}
        </a>
      </li>
    );
  }

  return (
    <li className="sidebar__item">
      <Link className="sidebar__link" href={link.href} data-tooltip={link.label}>
        {content}
      </Link>
    </li>
  );
}

function SidebarSection({
  heading,
  links,
}: {
  heading: string;
  links: SidebarLink[];
}) {
  return (
    <ul className="sidebar__list">
      <li className="sidebar__item item--heading">
        <span className="sidebar__item--heading">{heading}</span>
      </li>

      {links.map((link) => (
        <SidebarNavItem key={link.label} link={link} />
      ))}
    </ul>
  );
}

export default function Sidebar() {
  const { isAdmin, loading } = useCurrentUser();

  return (
    <aside className="sidebar vertical-sidebar">
      <input
        id="kapapala-sidebar-toggle"
        className="sidebar__checkbox"
        type="checkbox"
        defaultChecked
      />

      <nav className="sidebar__nav" aria-label="Primary navigation">
        <div className="sidebar__toggle-container">
          <label
            className="nav__toggle"
            htmlFor="kapapala-sidebar-toggle"
            aria-label="Toggle sidebar"
          >
            <span className="toggle--icons">
              <svg
                className="toggle-svg-icon toggle--open"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M9.29 6.71a1 1 0 0 1 1.42 0L16 12l-5.29 5.29a1 1 0 1 1-1.42-1.42L13.17 12 9.29 8.12a1 1 0 0 1 0-1.41Z" />
              </svg>

              <svg
                className="toggle-svg-icon toggle--close"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M14.71 6.71a1 1 0 0 0-1.42 0L8 12l5.29 5.29a1 1 0 1 0 1.42-1.42L10.83 12l3.88-3.88a1 1 0 0 0 0-1.41Z" />
              </svg>
            </span>
          </label>
        </div>

        <div className="sidebar__header">
          <figure className="sidebar__brand">
            <div className="codepen-logo" aria-hidden="true">
              🌿
            </div>

            <figcaption>
              <h1 className="user-id">Kapāpala</h1>
              <p className="user-role">
                {loading
                  ? "Loading access"
                  : isAdmin
                    ? "Access Administration"
                    : "Access Portal"}
              </p>
            </figcaption>
          </figure>
        </div>

        <div className="sidebar__wrapper">
          <SidebarSection heading="Main" links={mainLinks} />
          <SidebarSection heading="Information" links={infoLinks} />

          {!loading && isAdmin && (
            <>
              <SidebarSection heading="Administration" links={adminLinks} />
              <SidebarSection heading="Configuration" links={configurationLinks} />
            </>
          )}
        </div>

        <div className="sidebar__footer">
          <span className="sidebar__footer-icon" aria-hidden="true">
            ʻĀ
          </span>

          <div className="sidebar__footer-text">
            <strong>Mālama i ka ʻĀina</strong>
            <small>Respect the land. Secure every gate.</small>
          </div>
        </div>
      </nav>
    </aside>
  );
}