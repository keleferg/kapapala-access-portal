import LoginForm from "../../components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="public-landing">
      <section className="public-login-card">
        <p className="eyebrow">Kapāpala Forest Reserve Access Management System</p>

        <h1>Kapāpala Forest Reserve Access Portal</h1>

        <p className="muted-text">
          Apply for an access account, request daily access, and receive approved
          gate information through a secure public access system.
        </p>

        <LoginForm />
      </section>
    </main>
  );
}