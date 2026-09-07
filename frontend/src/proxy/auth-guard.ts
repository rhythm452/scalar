import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, SESSION_COOKIE_NAME } from "@/lib/constants";

export function isPublicPath(pathname: string): boolean {
  return pathname === LOGIN_PATH;
}

export function buildLoginRedirectUrl(nextUrl: URL): URL {
  const target = new URL(LOGIN_PATH, nextUrl.origin);
  target.searchParams.set("next", nextUrl.pathname + nextUrl.search);
  return target;
}

// Cookie-presence check only, no backend round trip. This is the first of two auth
// layers (docs/DECISIONS.md ADR-019) — a stale-but-present cookie still passes here;
// useSession's client-side 401 handling is the compensating second layer.
export function pageAuthGuard(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }
  if (request.cookies.get(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(buildLoginRedirectUrl(request.nextUrl));
}
