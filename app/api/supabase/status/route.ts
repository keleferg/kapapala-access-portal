import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

export async function GET() {
  const browserConfigured = isSupabaseConfigured();
  const adminConfigured = isSupabaseAdminConfigured();

  if (!adminConfigured) {
    return NextResponse.json({
      ok: browserConfigured,
      browserConfigured,
      adminConfigured,
      message: adminConfigured
        ? 'Supabase admin client configured.'
        : 'Supabase service role key not configured. Add SUPABASE_SERVICE_ROLE_KEY for server-side admin checks.',
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('gates').select('name,status').limit(3);

    if (error) {
      return NextResponse.json({ ok: false, browserConfigured, adminConfigured, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      browserConfigured,
      adminConfigured,
      gateCount: data?.length ?? 0,
      gates: data ?? [],
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      browserConfigured,
      adminConfigured,
      error: error instanceof Error ? error.message : 'Unknown Supabase status error',
    }, { status: 500 });
  }
}
