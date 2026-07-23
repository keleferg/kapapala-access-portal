'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { AppRole } from '@/lib/auth';

type GuardMode = 'user' | 'admin';

export default function AuthGuard({ mode, children }: { mode: GuardMode; children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'allowed' | 'signed-out' | 'forbidden' | 'demo'>('checking');

  useEffect(() => {
    async function check() {
      if (!isSupabaseConfigured()) {
        setState('demo');
        return;
      }

      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setState('signed-out');
        return;
      }

      if (mode === 'admin') {
        const { data: roleData, error: roleError } = await (supabase as any)
          .rpc('current_app_role');

        if (roleError) {
          console.error('Unable to verify admin role:', roleError);
          setState('forbidden');
          return;
        }

        const role = roleData as AppRole;
        setState(
          role === 'admin' || role === 'super_user'
            ? 'allowed'
            : 'forbidden'
        );
        return;
      }

      setState('allowed');
    }

    check();
  }, [mode]);

  if (state === 'checking') {
    return <Card title="Checking Access"><p className="muted-text">Verifying your session…</p></Card>;
  }

  if (state === 'demo') {
    return (
      <>
        <Card title="Demo Mode">
          <p className="muted-text">Supabase is not configured yet, so route protection is running in demo mode.</p>
          <StatusBadge label="Demo Access" tone="yellow" />
        </Card>
        {children}
      </>
    );
  }

  if (state === 'signed-out') {
    return (
      <Card title="Sign In Required">
        <p className="muted-text">Please sign in to continue.</p>
        <Link className="button primary" href="/login">Go to Login</Link>
      </Card>
    );
  }

  if (state === 'forbidden') {
    return (
      <Card title="Administrator Access Required">
        <p className="muted-text">Your account does not have permission to view this administrative area.</p>
        <StatusBadge label="Forbidden" tone="red" />
      </Card>
    );
  }

  return <>{children}</>;
}
