import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { mockLiveActivity } from '@/lib/mockData';

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ ...mockLiveActivity, source: 'mock' });
  }

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [accountRequests, dailyRequests, smsSent, gates] = await Promise.all([
    supabase.from('access_accounts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('daily_access_requests').select('id', { count: 'exact', head: true }).eq('request_date', today),
    supabase.from('sms_logs').select('id', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00.000Z`),
    supabase.from('gates').select('status'),
  ]);

  const gateRows = (gates.data ?? []) as Array<{ status: string }> ;
  const allOpen = gateRows.length > 0 && gateRows.every((gate) => gate.status === 'open');

  return NextResponse.json({
    accountRequests: accountRequests.count ?? 0,
    dailyRequestsToday: dailyRequests.count ?? 0,
    smsSentToday: smsSent.count ?? 0,
    gateStatus: allOpen ? 'All Gates Open' : 'Check Gate Status',
    source: 'supabase',
  });
}
