import { NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import { mockGates } from '@/lib/mockData';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ data: mockGates, source: 'mock' });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('gates').select('name,status,road_condition,notes').eq('active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, source: 'supabase' });
}
