import { NextRequest, NextResponse } from "next/server"

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith("/api/auth") || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next()
  }

  const hasSession =
    !!request.cookies.get("authjs.session-token") ||
    !!request.cookies.get("__Secure-authjs.session-token") ||
    !!request.cookies.get("next-auth.session-token") ||
    !!request.cookies.get("__Secure-next-auth.session-token")

  if (!hasSession && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
