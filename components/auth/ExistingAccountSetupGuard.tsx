"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "../../lib/supabaseClient";

const CURRENT_SETUP_VERSION = 1;

const EXCLUDED_PATHS = [
  "/login",
  "/logout",
  "/complete-account-setup",
  "/admin",
  "/api",
];

type SetupAccountRow = {
  id: string;
  setup_version: number | null;
};

function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export default function ExistingAccountSetupGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkSetupStatus() {
      if (!pathname || isExcludedPath(pathname)) {
        return;
      }

      try {
        const supabase = getSupabaseClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user || !isMounted) {
          return;
        }

        const { data, error: accountError } = await supabase
          .from("access_accounts")
          .select("id, setup_version")
          .eq("profile_id", user.id)
          .limit(1)
          .maybeSingle();

        const account = data as SetupAccountRow | null;

        if (accountError) {
          console.error(
            "Unable to check existing account setup status:",
            accountError
          );
          return;
        }

        if (!account || !isMounted) {
          return;
        }

        const setupVersion =
          typeof account.setup_version === "number"
            ? account.setup_version
            : 0;

        if (setupVersion < CURRENT_SETUP_VERSION) {
          router.replace("/complete-account-setup");
        }
      } catch (error) {
        console.error(
          "Unexpected error checking existing account setup:",
          error
        );
      }
    }

    void checkSetupStatus();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  return null;
}