import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

function addCorrelationHeader(response: NextResponse, correlationId: string): NextResponse {
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export async function middleware(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Log incoming request in development
  if (process.env.NODE_ENV === "development") {
    console.log(
      JSON.stringify({
        level: "info",
        correlationId,
        method: request.method,
        pathname,
        msg: "Incoming request",
      })
    );
  }

  // Redirect authenticated users away from auth pages
  if (sessionCookie && (pathname === "/login" || pathname === "/signup")) {
    return addCorrelationHeader(
      NextResponse.redirect(new URL("/dashboard", request.url)),
      correlationId
    );
  }

  // Protect dashboard and groceries routes - redirect unauthenticated users to login
  if (!sessionCookie && (pathname.startsWith("/dashboard") || pathname.startsWith("/groceries"))) {
    return addCorrelationHeader(
      NextResponse.redirect(new URL("/login", request.url)),
      correlationId
    );
  }

  // Redirect unauthenticated users from home to login
  if (!sessionCookie && pathname === "/") {
    return addCorrelationHeader(
      NextResponse.redirect(new URL("/login", request.url)),
      correlationId
    );
  }

  // Redirect authenticated users from home to dashboard
  if (sessionCookie && pathname === "/") {
    return addCorrelationHeader(
      NextResponse.redirect(new URL("/dashboard", request.url)),
      correlationId
    );
  }

  const response = NextResponse.next();
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export const config = {
  matcher: ["/", "/login", "/signup", "/dashboard/:path*", "/groceries/:path*"],
};
