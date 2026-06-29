import AppShell from '@/components/layout/AppShell';
import AuthStatusPanel from '@/components/auth/AuthStatusPanel';

export default function AuthStatusPage() {
  return (
    <AppShell>
      <div className="page-heading">
        <p>Version 2.3</p>
        <h2>Authentication Status</h2>
        <span>Live Supabase connection, user session, and role verification.</span>
      </div>
      <AuthStatusPanel />
    </AppShell>
  );
}
