import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";

export default function ApplyPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Access Account</p>
        <h2>Apply for an Access Account</h2>
        <span>Submit your contact information and identification for review.</span>
      </div>

      <Card title="Public Access Account Application">
        <form className="form-grid">
          <label>First Name<input placeholder="First name" /></label>
          <label>Last Name<input placeholder="Last name" /></label>
          <label>Email<input type="email" placeholder="name@example.com" /></label>
          <label>Mobile Phone<input placeholder="(808) 555-1234" /></label>
          <label>Government ID Upload<input type="file" /></label>
          <label>Primary Purpose<select defaultValue=""><option value="" disabled>Select purpose</option><option>Hunting</option><option>Forest Reserve Access</option><option>Other</option></select></label>
        </form>
        <button className="button primary form-button">Submit Application</button>
      </Card>
    </AppShell>
  );
}
