import Link from "next/link";
import StatusBadge from "../components/ui/StatusBadge";

export default function HomePage() {
  return (
    <main className="public-page">
      <section className="public-hero">
        <div className="public-nav">
          <strong>Kapāpala Ranch</strong>
          <Link href="/dashboard">Portal Login</Link>
        </div>

        <div className="public-hero-content">
          <p className="hero-subtitle">Public Access Management System</p>
          <h1>Kapāpala Access Portal</h1>
          <p>
            Apply for an access account, request daily access, and receive approved
            gate information through a secure public access system.
          </p>
          <div className="public-actions">
            <Link className="button primary" href="/apply">Apply for Access Account</Link>
            <Link className="button secondary light" href="/request-access">Request Daily Access</Link>
          </div>
          <div className="public-status"><StatusBadge label="Public Access Open" tone="green" /></div>
        </div>
      </section>
    </main>
  );
}
