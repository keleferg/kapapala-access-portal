'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';

type StatusState = {
  configured: boolean;
  authenticated: boolean;
  email?: string;
  role?: string;
  profileName?: string;
  message: string;
};

export default function AuthStatusPanel() {
  const [status, setStatus] = useState<StatusState>({
    configured: isSupabaseConfigured(),
    authenticated: false,
    message: 'Checking Supabase connection…',
  });

  useEffect(() => {
    async function loadStatus() {
      if (!isSupabaseConfigured()) {
        setStatus({
          configured: false,
          authenticated: false,
          message: 'Supabase environment variables are not configured. Add .env.local values to enable authentication.',
        });
        return;
      }

      const supabase = getSupabaseClient();
      const { data: sessionData, error } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (error) {
        setStatus({ configured: true, authenticated: false, message: error.message });
        return;
      }

      if (!user) {
        setStatus({ configured: true, authenticated: false, message: 'Supabase is connected. No user is currently signed in.' });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, role')
        .eq('id', user.id)
        .single();

      const typedProfile = profile as { first_name?: string | null; last_name?: string | null; email?: string | null; role?: string | null } | null;

      setStatus({
        configured: true,
        authenticated: true,
        email: user.email ?? typedProfile?.email ?? '',
        role: typedProfile?.role ?? 'public_user',
        profileName: `${typedProfile?.first_name ?? ''} ${typedProfile?.last_name ?? ''}`.trim(),
        message: 'Supabase authentication is connected and session lookup is working.',
      });
    }

    loadStatus();
  }, []);

  return (
    <div className="card-grid two">
      <Card title="Supabase Connection">
        <StatusBadge label={status.configured ? 'Configured' : 'Not Configured'} tone={status.configured ? 'green' : 'yellow'} />
        <p className="muted-text">{status.message}</p>
      </Card>

      <Card title="Current Session">
        <StatusBadge label={status.authenticated ? 'Signed In' : 'Signed Out'} tone={status.authenticated ? 'green' : 'gray'} />
        {status.authenticated ? (
          <div className="compact-profile-list">
            <div><span>Name</span><strong>{status.profileName || 'Profile name not set'}</strong></div>
            <div><span>Email</span><strong>{status.email}</strong></div>
            <div><span>Role</span><strong>{status.role}</strong></div>
          </div>
        ) : (
          <p className="muted-text">Sign in from /login to test the full authentication loop.</p>
        )}
      </Card>
    </div>
  );
}
