import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

function getSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/set-password";
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/?error=invalid-reset-link", requestUrl.origin)
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase environment variables are missing in auth confirmation."
    );

    return NextResponse.redirect(
      new URL("/?error=auth-configuration", requestUrl.origin)
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: Parameters<typeof cookieStore.set>[2];
          }>
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !data.session) {
    console.error(
      "Unable to verify Supabase recovery token:",
      error?.message ?? "Recovery session was not returned."
    );

    return NextResponse.redirect(
      new URL(
        "/?error=expired-or-invalid-link",
        requestUrl.origin
      )
    );
  }

  /*
   * Explicitly hand the verified recovery session to the browser.
   * URL fragments are not sent to the server and SetPasswordForm removes
   * these values immediately after establishing the browser session.
   */
  const destination = new URL(next, requestUrl.origin);

  destination.hash = new URLSearchParams({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    type: "recovery",
  }).toString();

  return NextResponse.redirect(destination);
}
