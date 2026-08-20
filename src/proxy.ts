import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

/**
 * Route protection.
 *
 *  /teacher/*   → role === "teacher" (or admin)
 *  /student/*   → role === "student" (or admin)
 *
 * Unauthenticated users are redirected to /login with a ?next= param so they
 * land back on the requested page after signing in. Authenticated users
 * landing on /login are redirected to their dashboard.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySession(token);

  const isTeacherArea = pathname.startsWith("/teacher");
  const isStudentArea = pathname.startsWith("/student");
  const isLoginPage   = pathname === "/login";

  if (isLoginPage && session) {
    const dest = session.role === "teacher" || session.role === "admin" ? "/teacher" : "/student";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if ((isTeacherArea || isStudentArea) && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (isTeacherArea && session && session.role !== "teacher" && session.role !== "admin") {
    return NextResponse.redirect(new URL("/student", req.url));
  }

  if (isStudentArea && session && session.role !== "student" && session.role !== "admin") {
    return NextResponse.redirect(new URL("/teacher", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/teacher/:path*", "/student/:path*", "/login"],
};
