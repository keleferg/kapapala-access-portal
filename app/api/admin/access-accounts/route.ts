import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { mockAccessAccounts } from '@/lib/mockData';

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ data: mockAccessAccounts, source: 'mock' });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('access_accounts')
    .select(`
      id,
      access_id,
      status,
      expires_at,
      profiles(first_name,last_name,email,phone),
      vehicles(label,license_plate,color,make,model)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, source: 'supabase' });
}
