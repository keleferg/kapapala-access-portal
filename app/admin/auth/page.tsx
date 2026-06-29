import AppShell from '@/components/layout/AppShell';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';

export default function AdminAuthPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Administration</p>
        <h2>Authentication & Roles</h2>
        <span>Version 2.3 role model for public users, administrators, and super administrators.</span>
      </div>

      <div className="card-grid three">
        <Card title="Public User">
          <StatusBadge label="Default" tone="gray" />
          <p className="muted-text">Can view their own profile, vehicles, documents, and access requests.</p>
        </Card>
        <Card title="Administrator">
          <StatusBadge label="Staff" tone="yellow" />
          <p className="muted-text">Can review accounts, approve requests, manage gates, and view reports.</p>
        </Card>
        <Card title="Super Administrator">
          <StatusBadge label="Owner" tone="green" />
          <p className="muted-text">Can manage users, system configuration, business rules, and security settings.</p>
        </Card>
      </div>

      <Card title="Route Protection Plan">
        <div className="configuration-table">
          <div><strong>Area</strong><strong>Required Role</strong><strong>Status</strong><strong>Notes</strong></div>
          <div><span>/dashboard</span><span>Public User</span><StatusBadge label="Scaffolded" tone="yellow" /><span>Will require sign-in before production.</span></div>
          <div><span>/request-access</span><span>Public User</span><StatusBadge label="Scaffolded" tone="yellow" /><span>Will validate active Access Account before submission.</span></div>
          <div><span>/admin/*</span><span>Admin</span><StatusBadge label="Scaffolded" tone="yellow" /><span>Will block non-admin sessions after Supabase setup.</span></div>
          <div><span>/admin/configuration</span><span>Super Admin</span><StatusBadge label="Planned" tone="gray" /><span>Highest-risk settings stay restricted.</span></div>
        </div>
      </Card>
    </AppShell>
  );
}
