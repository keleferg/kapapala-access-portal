"use client";

import { useEffect } from "react";

export default function RecoveryLinkRedirect() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const hasRecoverySession =
      fragment.get("type") === "recovery" ||
      (fragment.has("access_token") && fragment.has("refresh_token"));
    const hasRecoveryCode = url.searchParams.has("code");
    const hasRecoveryToken =
      url.searchParams.get("type") === "recovery" &&
      url.searchParams.has("token_hash");

    if (!hasRecoverySession && !hasRecoveryCode && !hasRecoveryToken) return;

    // The configured Auth site URL may be the root if the requested
    // redirect URL has not been added to Supabase's allow list.
    url.pathname = hasRecoveryToken ? "/auth/confirm" : "/set-password";
    window.location.replace(url.toString());
  }, []);

  return null;
}
