import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      status: 'ok',
      supabase: 'not_configured',
      auth: 'demo_mode',
      mode: 'ui_with_mock_data',
    });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      status: 'ok',
      supabase: 'browser_configured',
      auth: 'client_auth_ready',
      note: 'Add SUPABASE_SERVICE_ROLE_KEY to enable server-side database health checks.',
    });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('gates').select('id,name,status').limit(3);

  return NextResponse.json({
    status: error ? 'degraded' : 'ok',
    supabase: error ? 'configured_but_query_failed' : 'connected',
    auth: 'client_auth_ready',
    gates: data ?? [],
    error: error?.message ?? null,
  });
}
