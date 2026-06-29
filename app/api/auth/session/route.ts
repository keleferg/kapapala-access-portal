import { NextResponse } from 'next/server';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabaseClient';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, authenticated: false, role: null });
  }

  return NextResponse.json({
    configured: true,
    authenticated: false,
    note: 'Client-side Supabase auth is enabled. Server session helpers will be added when middleware/cookie auth is enabled.',
    hasClient: Boolean(getSupabaseClient),
  });
}
