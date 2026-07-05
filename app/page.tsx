import LoginForm from "../components/auth/LoginForm";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="public-landing">
      <section className="public-login-card">
        <div className="brand-mark" style={{ marginBottom: 16 }}>🌿</div>

        <p className="eyebrow">Kapapala Forest Reserve Access Management System</p>
        <h1>Kapāpala Access Portal</h1>

        <p className="muted-text">
          Apply for an access account, request daily access, and receive approved
          gate information through a secure public access system.
        </p>

        <LoginForm />

        <div className="public-divider">or</div>

        <Link className="button secondary full-width" href="/request-account">
          Request an Account
        </Link>

        <p className="muted-text" style={{ marginTop: 16, textAlign: "center" }}>
          Need help? Contact operations@kapapalaranch.com.
        </p>
      </section>
    </main>
  );
}