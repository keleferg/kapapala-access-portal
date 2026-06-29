import { NextResponse } from 'next/server';

export async function GET() {
  // Supabase Auth callback placeholder.
  // This will exchange the auth code for a session once server-side auth is enabled.
  return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
