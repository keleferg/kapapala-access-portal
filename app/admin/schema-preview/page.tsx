import AppShell from '@/components/layout/AppShell';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';

const tables = [
  'profiles',
  'access_accounts',
  'vehicles',
  'gates',
  'gate_combinations',
  'daily_access_requests',
  'documents',
  'timeline_events',
  'sms_logs',
];

export default function SchemaPreviewPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Version 2.0</p>
          <h1>Backend Foundation</h1>
          <p className="muted-text">Supabase schema, roles, security, and API scaffolding.</p>
        </div>
        <StatusBadge label="Ready for Supabase" tone="green" />
      </div>

      <div className="card-grid">
        <Card title="Authentication">
          <h2>Supabase Auth</h2>
          <p>Email/password login, user profiles, and role-based access are scaffolded.</p>
        </Card>
        <Card title="Database">
          <h2>PostgreSQL</h2>
          <p>Core tables are defined in db/schema.sql and db/migrations/001_initial_schema.sql.</p>
        </Card>
        <Card title="Security">
          <h2>RLS</h2>
          <p>Row Level Security policies are included for public users and administrators.</p>
        </Card>
      </div>

      <br />

      <Card title="Tables Included">
        <div className="pill-list">
          {tables.map((table) => (
            <span className="data-pill" key={table}>{table}</span>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
