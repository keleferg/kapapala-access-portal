'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { CurrentUser } from '@/lib/auth';

export default function AuthStatus() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        if (!configured) {
          if (active) setLoading(false);
          return;
        }

        const supabase = getSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const authUser = sessionData.session?.user;

        if (!authUser) {
          if (active) setUser(null);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, role')
          .eq('id', authUser.id)
          .maybeSingle();

        const typedProfile = profile as {
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          role?: CurrentUser['role'];
        } | null;

        if (active) {
          setUser({
            id: authUser.id,
            email: authUser.email ?? typedProfile?.email ?? '',
            firstName:
              typedProfile?.first_name ||
              authUser.user_metadata?.first_name ||
              '',
            lastName:
              typedProfile?.last_name ||
              authUser.user_metadata?.last_name ||
              '',
            role: (typedProfile?.role ?? 'public_user') as CurrentUser['role'],
          });
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUser();

    if (!configured) {
      return () => {
        active = false;
      };
    }

    const supabase = getSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [configured]);

  if (!configured) {
    return <StatusBadge label="Demo Mode" tone="yellow" />;
  }

  if (loading) return <div className="user-chip">Checking session…</div>;

  if (!user) {
    return (
      <Link className="user-chip" href="/">
        👤 Sign In
      </Link>
    );
  }

  const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email;

  return (
    <div className="auth-status-group">
      <Link className="user-chip" href="/auth-status">
        👤 {displayName}
      </Link>
      <Link className="logout-link" href="/logout">
        Log out
      </Link>
    </div>
  );
}