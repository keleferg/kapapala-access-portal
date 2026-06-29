'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';

export default function LoginPanel() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!configured) {
      setError('Supabase is not configured yet. Add your .env.local values first.');
      return;
    }

    setLoading(true);
    const supabase = getSupabaseClient();

    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
      else {
        setMessage('Signed in successfully. Redirecting…');
        window.location.href = '/dashboard';
      }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (signUpError) setError(signUpError.message);
      else setMessage('Account created. Check email confirmation if enabled in Supabase.');
    }

    setLoading(false);
  }

  return (
    <div className="auth-page">
      <Card title="Kapāpala Access Portal Login" subtitle="Secure sign-in powered by Supabase Auth.">
        <div className="auth-mode-row">
          <button className={`filter-chip ${mode === 'signin' ? 'active' : ''}`} onClick={() => setMode('signin')} type="button">Sign In</button>
          <button className={`filter-chip ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')} type="button">Create Login</button>
        </div>

        {!configured && (
          <div className="info-callout warning">
            <strong>Supabase not connected</strong>
            <p>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.</p>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="form-grid">
              <label>
                First Name
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
              </label>
              <label>
                Last Name
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
              </label>
            </div>
          )}

          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" required />
          </label>

          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required />
          </label>

          {error && <div className="auth-message error">{error}</div>}
          {message && <div className="auth-message success">{message}</div>}

          <button className="button primary" type="submit" disabled={loading}>
            {loading ? 'Working…' : mode === 'signin' ? 'Sign In' : 'Create Login'}
          </button>
        </form>

        <div className="auth-links">
          <Link href="/apply">Apply for an Access Account</Link>
          <Link href="/dashboard">Continue to Demo Dashboard</Link>
          <Link href="/auth-status"><StatusBadge label="View Auth Status" tone="gray" /></Link>
        </div>
      </Card>
    </div>
  );
}
