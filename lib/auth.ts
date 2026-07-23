import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export type AppRole = 'user' | 'public_user' | 'admin' | 'super_user';

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

  const [{ data: profile }, { data: roleData, error: roleError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .eq('id', user.id)
        .single(),
      (supabase as any).rpc('current_app_role'),
    ]);

  if (roleError) {
    console.error('Unable to load current app role:', roleError);
  }

  const typedProfile = profile as {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;

  return {
    id: user.id,
    email: user.email ?? typedProfile?.email ?? '',
    firstName:
      typedProfile?.first_name || user.user_metadata?.first_name || '',
    lastName:
      typedProfile?.last_name || user.user_metadata?.last_name || '',
    role: (roleData ?? 'user') as AppRole,
  };
}

export function isAdminRole(role?: AppRole | null) {
  return role === 'admin' || role === 'super_user';
}
