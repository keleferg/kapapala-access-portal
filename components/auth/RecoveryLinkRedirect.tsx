"use client";

import { useEffect } from "react";

export default function RecoveryLinkRedirect() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));

    if (fragment.get("type") !== "recovery") return;

    // The configured Auth site URL may be the root if the requested
    // redirect URL has not been added to Supabase's allow list.
    url.pathname = "/set-password";
    url.search = "";
    window.location.replace(url.toString());
  }, []);

  return null;
}
