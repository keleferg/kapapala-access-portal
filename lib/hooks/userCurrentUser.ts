"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../supabaseClient";
import type { UserRole } from "../auth/roles";
import {
  canAccessAdmin,
  canManageSystem,
  canOperateGate,
} from "../auth/roles";

type CurrentUserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: UserRole | null;
};

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [appRole, setAppRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadUser() {
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseClient();

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      const user = userData.user;

      if (!user) {
        setUserId(null);
        setProfile(null);
        setAppRole(null);
        return;
      }

      setUserId(user.id);

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
        throw new Error(profileError.message);
      }

      if (roleError) {
        throw new Error(roleError.message);
      }

      setProfile(profileData as CurrentUserProfile);
      setAppRole((roleData ?? "user") as UserRole);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to load user."
      );
      setAppRole(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUser();
  }, []);

  return {
    userId,
    profile,
    role: appRole,
    loading,
    error,
    isSignedIn: Boolean(userId),
    isAdmin: canAccessAdmin(appRole),
    canManageSystem: canManageSystem(appRole),
    canOperateGate: canOperateGate(appRole),
    refresh: loadUser,
  };
}
