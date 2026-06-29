'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';

export default function LogoutPanel() {
  const [message, setMessage] = useState('Signing out…');

  useEffect(() => {
    async function logout() {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
      }
      setMessage('You have been signed out.');
    }
    logout();
  }, []);

  return (
    <div className="auth-page">
      <Card title="Signed Out">
        <p className="muted-text">{message}</p>
        <Link className="button primary" href="/login">Return to Login</Link>
      </Card>
    </div>
  );
}
