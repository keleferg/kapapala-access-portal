import { NextResponse } from "next/server";

function getSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/set-password";
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(
      new URL("/?error=invalid-reset-link", requestUrl.origin)
    );
  }

  const canonicalOrigin =
    process.env.NEXT_PUBLIC_PORTAL_BASE_URL ||
    "https://forestreserveaccess.kapapalaranch.com";
  const destination = new URL(next, canonicalOrigin);

  destination.hash = new URLSearchParams({
    token_hash: tokenHash,
    type: "recovery",
  }).toString();

  return NextResponse.redirect(destination);
}
