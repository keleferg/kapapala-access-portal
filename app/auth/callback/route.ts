import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/login?error=missing-auth-code",
        requestUrl.origin
      )
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase environment variables are missing in auth callback."
    );

    return NextResponse.redirect(
      new URL(
        "/login?error=auth-configuration",
        requestUrl.origin
      )
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
            options: Record<string, unknown>;
          }>
        ) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(name, value, options);
              }
            );
          } catch {
            /*
             * This may occur when cookies cannot be written in
             * the current rendering context. In this route handler,
             * cookies should normally be writable.
             */
          }
        },
      },
    }
  );

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(
      "Unable to exchange Supabase auth code:",
      error.message
    );

    return NextResponse.redirect(
      new URL(
        "/login?error=expired-or-invalid-link",
        requestUrl.origin
      )
    );
  }

  return NextResponse.redirect(
    new URL(next, requestUrl.origin)
  );
}
