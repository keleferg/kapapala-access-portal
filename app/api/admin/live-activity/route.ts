import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { mockLiveActivity } from '@/lib/mockData';

function getHawaiiDateString(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Pacific/Honolulu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  if (!year || !month || !day) {
    throw new Error('Unable to calculate the Hawaiʻi date.');
  }

  const adjusted = new Date(Date.UTC(year, month - 1, day + offsetDays));

  return [
    adjusted.getUTCFullYear(),
    String(adjusted.getUTCMonth() + 1).padStart(2, '0'),
    String(adjusted.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ ...mockLiveActivity, source: 'mock' });
  }

  const supabase = getSupabaseAdmin();
  const today = getHawaiiDateString();
  const tomorrow = getHawaiiDateString(1);

  const hawaiiDayStart = `${today}T00:00:00-10:00`;
  const hawaiiDayEnd = `${tomorrow}T00:00:00-10:00`;

  const [accountRequests, dailyRequests, smsSent, gates] = await Promise.all([
    supabase.from('access_accounts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('daily_access_requests').select('id', { count: 'exact', head: true }).eq('request_date', today),
    supabase
      .from('sms_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', hawaiiDayStart)
      .lt('created_at', hawaiiDayEnd),
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
