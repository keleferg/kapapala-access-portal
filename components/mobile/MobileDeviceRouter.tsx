"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";

const routeMap: Record<string, string> = {
  "/dashboard": "/mobile",
  "/request-access": "/mobile/new-request",
  "/my-access-requests": "/mobile/requests",
  "/trip-history": "/mobile/history",
  "/apply": "/mobile/account",
};

export default function MobileDeviceRouter() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function routeMobilePublicUser() {
      if (!routeMap[pathname] || window.localStorage.getItem("kapapala-desktop-site") === "1") return;
      const ua = navigator.userAgent || "";
      const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
      const isAndroidPhone = /Android/i.test(ua) && /Mobile/i.test(ua);
      const narrowNonApplePhone = window.matchMedia("(max-width: 767px)").matches && !isAppleMobile && /Mobile/i.test(ua);
      if (!isAndroidPhone && !narrowNonApplePhone) return;
      if (!isSupabaseConfigured()) return;

      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) return;
      const { data: role } = await (supabase as any).rpc("current_app_role");
      if (role === "admin" || role === "super_user") return;
      router.replace(routeMap[pathname]);
    }
    void routeMobilePublicUser();
  }, [pathname, router]);

  return null;
}
