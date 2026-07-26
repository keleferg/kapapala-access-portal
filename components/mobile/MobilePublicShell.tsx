"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const nav = [
  { href: "/mobile", label: "Home", icon: "⌂" },
  { href: "/mobile/requests", label: "Requests", icon: "▣" },
  { href: "/mobile/gate-code", label: "Gate Code", icon: "🔒" },
  { href: "/mobile/account", label: "Account", icon: "◎" },
];

export default function MobilePublicShell({
  title,
  eyebrow = "Kapāpala Access",
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    document.body.classList.add("mobile-public-active");
    return () => document.body.classList.remove("mobile-public-active");
  }, []);

  function useDesktopSite() {
    window.localStorage.setItem("kapapala-desktop-site", "1");
    const map: Record<string, string> = {
      "/mobile": "/dashboard",
      "/mobile/requests": "/my-access-requests",
      "/mobile/new-request": "/request-access",
      "/mobile/gate-code": "/my-access-requests",
      "/mobile/account": "/apply",
      "/mobile/history": "/trip-history",
    };
    router.replace(map[pathname] || "/dashboard");
  }

  return (
    <div className="mobile-public-shell">
      <header className="mobile-public-header">
        <div className="mobile-public-brand">
          <img src="/kapapala-access-logo.png" alt="Kapāpala" />
          <div><span>{eyebrow}</span><h1>{title}</h1></div>
        </div>
        <button className="mobile-desktop-link" type="button" onClick={useDesktopSite}>Desktop</button>
      </header>

      <main className="mobile-public-content">{children}</main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {nav.map((item) => {
          const active = item.href === "/mobile" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""}>
              <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
