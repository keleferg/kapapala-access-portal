import type { NextRequest } from "next/server";
import { NextResponse, userAgent } from "next/server";

const MOBILE_ROUTE_MAP: Record<string, string> = {
  "/": "/mobile",
  "/dashboard": "/mobile",
  "/request-access": "/mobile/new-request",
  "/my-access-requests": "/mobile/requests",
  "/trip-history": "/mobile/history",
};

function isAndroidPhone(request: NextRequest): boolean {
  const ua = userAgent(request);
  const rawUserAgent = request.headers.get("user-agent") ?? "";

  return (
    /Android/i.test(rawUserAgent) &&
    ua.device.type === "mobile"
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Never redirect:
   * - the mobile portal itself
   * - admin pages
   * - authentication/password pages
   * - API routes
   * - Next.js assets
   * - normal public files
   */
  if (
    pathname.startsWith("/mobile") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname === "/set-password" ||
    pathname === "/complete-account-setup" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!isAndroidPhone(request)) {
    return NextResponse.next();
  }

  const mobileDestination = MOBILE_ROUTE_MAP[pathname];

  if (!mobileDestination) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = mobileDestination;

  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Run on page routes, while excluding static assets and image handling.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
