import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from auth pages
  if (sessionCookie && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protect dashboard routes - redirect unauthenticated users to login
  if (!sessionCookie && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect unauthenticated users from home to login
  if (!sessionCookie && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users from home to dashboard
  if (sessionCookie && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup", "/dashboard/:path*"],
};
