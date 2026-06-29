import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export type AppRole = 'public_user' | 'admin' | 'super_admin';

export type CurrentUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AppRole;
};

export async function getCurrentUserClient(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role')
    .eq('id', user.id)
    .single();

  const typedProfile = profile as { email?: string | null; first_name?: string | null; last_name?: string | null; role?: AppRole } | null;

  return {
    id: user.id,
    email: user.email ?? typedProfile?.email ?? '',
    firstName: typedProfile?.first_name || user.user_metadata?.first_name || '',
    lastName: typedProfile?.last_name || user.user_metadata?.last_name || '',
    role: (typedProfile?.role ?? 'public_user') as AppRole,
  };
}

export function isAdminRole(role?: AppRole | null) {
  return role === 'admin' || role === 'super_admin';
}
