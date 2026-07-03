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
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    setLoading(true);

    const supabase = getSupabaseClient();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, role")
      .eq("id", user.id)
      .single();

    setProfile(data ? (data as CurrentUserProfile) : null);
    setLoading(false);
  }

  useEffect(() => {
    loadUser();
  }, []);

  return {
    profile,
    role: profile?.role ?? null,
    loading,
    isSignedIn: Boolean(profile),
    isAdmin: canAccessAdmin(profile?.role),
    refresh: loadUser,
  };
}