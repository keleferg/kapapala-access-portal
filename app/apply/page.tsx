import Link from "next/link";
import MyAccessAccountPage from "../../components/account/MyAccessAccountPage";

export default function ApplyPage() {
  return (
    <main className="portal-page-background">
      <section className="public-application-card access-account-page-card">
        <Link href="/dashboard" className="button secondary">
          Back to Dashboard
        </Link>

        <MyAccessAccountPage />
      </section>
    </main>
  );
}