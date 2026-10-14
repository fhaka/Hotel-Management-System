import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/permissions";

// Optimistic route protection. Every page and action re-checks access against the database.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && !isStaff(session.role)) {
    return NextResponse.redirect(new URL("/account", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
