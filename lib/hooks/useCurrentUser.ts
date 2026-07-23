"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../supabaseClient";
import { canAccessAdmin } from "../auth/roles";
import type { UserRole } from "../auth/roles";

type CurrentUserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: UserRole | null;
};

export function useCurrentUser() {
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [appRole, setAppRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    setLoading(true);

    try {
      const supabase = getSupabaseClient();

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const user = userData.user;

      if (!user) {
        setProfile(null);
        setAppRole(null);
        return;
      }

      const [
        { data: profileData, error: profileError },
        { data: roleData, error: roleError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email, role")
          .eq("id", user.id)
          .single(),
        (supabase as any).rpc("current_app_role"),
      ]);

      if (profileError) {
        throw profileError;
      }

      if (roleError) {
        throw roleError;
      }

      setProfile(profileData as CurrentUserProfile);
      setAppRole((roleData ?? "user") as UserRole);
    } catch (error) {
      console.error("Unable to load current user:", error);
      setProfile(null);
      setAppRole(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUser();
  }, []);

  return {
    profile,
    role: appRole,
    loading,
    isSignedIn: Boolean(profile),
    isAdmin: canAccessAdmin(appRole),
    refresh: loadUser,
  };
}
