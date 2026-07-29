import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse, userAgent } from "next/server";

const MOBILE_ROUTE_MAP: Record<string, string> = {
  "/": "/mobile",
  "/dashboard": "/mobile",
  "/request-access": "/mobile/new-request",
  "/apply": "/mobile/new-request",
  "/my-access-requests": "/mobile/requests",
  "/trip-history": "/mobile/history",
};

const PUBLIC_ROUTES = new Set([
  "/login",
  "/logout",
  "/request-account",
  "/set-password",
  "/complete-account-setup",
  "/auth-status",
]);

function isAndroidPhone(request: NextRequest): boolean {
  const ua = userAgent(request);
  const rawUserAgent = request.headers.get("user-agent") ?? "";

  return /Android/i.test(rawUserAgent) && ua.device.type === "mobile";
}

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.has(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  );
}

function copyCookies(
  source: NextResponse,
  destination: NextResponse,
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    destination.cookies.set(cookie);
  });

  return destination;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );

    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/login";
    errorUrl.search = "";
    errorUrl.searchParams.set("error", "authentication-unavailable");

    return NextResponse.redirect(errorUrl);
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[],
      ) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.search = "";

    const requestedDestination = `${pathname}${search}`;

    if (pathname !== "/" && requestedDestination !== "/login") {
      loginUrl.searchParams.set("next", requestedDestination);
    }

    loginUrl.searchParams.set("reason", "login-required");

    const redirectResponse = NextResponse.redirect(loginUrl);

    return copyCookies(response, redirectResponse);
  }

  if (
    isAndroidPhone(request) &&
    !pathname.startsWith("/mobile") &&
    !pathname.startsWith("/admin")
  ) {
    const mobileDestination = MOBILE_ROUTE_MAP[pathname];

    if (mobileDestination) {
      const mobileUrl = request.nextUrl.clone();
      mobileUrl.pathname = mobileDestination;

      const redirectResponse = NextResponse.redirect(mobileUrl);

      return copyCookies(response, redirectResponse);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
